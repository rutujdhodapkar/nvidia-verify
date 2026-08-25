// DEV/CRAFT LinkedIn Automation — max-impressions engine
// Pipeline: scrape site (5-day DB cache) -> NVIDIA agent generates post
//           (elite 2026-algorithm prompts + legal guardrails + emoji anchors)
//           -> AI self-review -> AI improve pass -> post via Composio/Zapier/direct.
// Self-healing: retries with error budgets (max 10), stale-cache rescue,
//               every failure logged to Firebase for later inspection.

import { postToLinkedinViaZapier } from '../lib/zapier-mcp.js';
import { createLinkedInPost } from '../lib/composio-linkedin.js';
import { postToLinkedinPageWithComment } from './linkedin-poster.js';
import { pfGet as fbGet, pfPut as fbPut } from '../lib/portfolio-firebase.js';
import { ensureFreshSiteData, createErrorBudget } from '../lib/site-scraper.js';
import { generatePost, reviewPost, atlasImprovePost } from './generator.js';

const SITE_URL = process.env.SITE_URL || 'https://devcraft.fennark.xyz';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const ZAPIER_TOKEN = process.env.ZAPIER_TOKEN;

const MAX_TOTAL_ERRORS = 10;
const HISTORY_LIMIT = 10;

// ---------- slot & angle ----------
function slotFromArgOrTime() {
  const arg = process.argv.find(a => ['morning', 'afternoon', 'evening'].includes(a));
  if (arg) return arg;
  const istHour = (new Date().getUTCHours() + 5.5) % 24;
  if (istHour < 12) return 'morning';
  if (istHour < 17) return 'afternoon';
  return 'evening';
}

// Rotation keeps the 3 daily posts in different lanes; day-of-year shifts them daily
const ANGLES = {
  morning: [
    'Career-truth / myth-busting angle (CGPA vs projects, marks vs skills). Bold opinionated hook.',
    'Learning-roadmap or skill-gap angle. Concrete steps a 2nd/3rd year can start tonight.',
    'Trend-explainer angle (AI tools, cloud, web dev) tied to student careers.',
  ],
  afternoon: [
    'Internship pitch angle — what you get: real tasks, mentor reviews, offer letter, LOR, completion certificate.',
    'Domain-showcase angle — help students pick between Web/Python/Data/AI/Design tracks.',
    'Flexibility angle — virtual, college-friendly timelines, async tasks.',
  ],
  evening: [
    'Project/portfolio angle — build-in-public, GitHub presence, proof of work beats bullets.',
    'Interview-readiness angle — what interviewers actually ask vs what students prepare.',
    'Peer-proof / community angle — shipping together, sharing wins, year-2 students already building.',
  ],
};

function pickAngle(slot) {
  const list = ANGLES[slot];
  const now = new Date();
  const doy = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 0))) / 86400000);
  return list[(doy * 3 + ['morning', 'afternoon', 'evening'].indexOf(slot)) % list.length];
}

// ---------- firebase state ----------
async function alreadyPostedToday(slot) {
  return !!(await fbGet(`linkedin/posts/${new Date().toISOString().slice(0, 10)}_${slot}`));
}

async function markPosted(slot, meta) {
  await fbPut(`linkedin/posts/${new Date().toISOString().slice(0, 10)}_${slot}`, { ...meta, postedAt: new Date().toISOString() });
}

async function recentPostSummaries(limit = HISTORY_LIMIT) {
  try {
    const all = (await fbGet('linkedin/posts')) || {};
    return Object.values(all)
      .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''))
      .slice(0, limit)
      .map(p => `${p.theme || p.angle || ''} ${(p.firstLine || '')}`.trim())
      .filter(Boolean);
  } catch { return []; }
}

// ---------- main ----------
export async function main() {
  const slot = slotFromArgOrTime();
  const budget = createErrorBudget(MAX_TOTAL_ERRORS);
  console.log(`=== LinkedIn Automation ${new Date().toISOString()} ===`);
  console.log(`Slot: ${slot} | DRY_RUN=${DRY_RUN}\n`);

  if (!DRY_RUN && !process.env.COMPOSIO_API_KEY && !ZAPIER_TOKEN && !process.env.LINKEDIN_CLIENT_ID) {
    console.error('Missing posting credentials — set COMPOSIO_API_KEY, ZAPIER_TOKEN, or LINKEDIN_* OAuth vars');
    process.exit(1);
  }

  if (await alreadyPostedToday(slot)) {
    console.log(`Already posted for slot "${slot}" today. Skipping.`);
    return;
  }

  // 1) Site data: DB-cached, re-scraped at most every 5 days, self-healed
  let siteData = null;
  try {
    siteData = await ensureFreshSiteData({ budget });
  } catch (err) {
    console.error(`[WARN] scraping failed entirely: ${err.message.slice(0, 140)} — generating without fresh context`);
  }

  // 2) History for dedup (agent avoids repeating recent angles)
  const previousPosts = await recentPostSummaries();
  const angleHint = pickAngle(slot);
  console.log(`[ANGLE] ${angleHint}\n`);

  // 3) Generate with the elite engine (retry up to 2 full regenerations)
  if (!NVIDIA_KEY) throw new Error('NVIDIA_API_KEY not set');
  let result = null;
  let feedback;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (budget.exceeded()) break;
    try {
      result = await generatePost(siteData || { pages: {}, theme: null }, previousPosts, NVIDIA_KEY, NVIDIA_MODEL, feedback, angleHint);
      break;
    } catch (err) {
      budget.recordFailure();
      feedback = err.message.slice(0, 300);
      console.warn(`[GEN] attempt ${attempt}/2 failed: ${feedback}`);
    }
  }
  if (!result?.post) throw new Error('post generation failed after retries');

  // 4) AI self-review + improve pass (best-effort, never blocks posting)
  try {
    const review = await reviewPost(result.post, NVIDIA_KEY, NVIDIA_MODEL);
    const verdict = typeof review === 'string' ? review : JSON.stringify(review);
    console.log(`[REVIEW] ${verdict.slice(0, 200)}`);
    const needsFix = /fix|violation|weak|improve|rewrite/i.test(verdict) && verdict.length < 600;
    if (needsFix) {
      const improved = await atlasImprovePost(result.post, NVIDIA_KEY, NVIDIA_MODEL);
      if (improved?.post || typeof improved === 'string') {
        result.post = typeof improved === 'string' ? improved : improved.post;
        console.log('[IMPROVE] applied AI polish pass');
      }
    }
  } catch (err) {
    console.warn(`[REVIEW] skipped (${String(err.message).slice(0, 100)})`);
  }

  // 5) Hard guarantee: link present in body + first comment
  let body = result.post;
  if (!body.toLowerCase().includes('devcraft.fennark.xyz')) body += `\n\nExplore: devcraft.fennark.xyz`;
  const firstComment = result.firstComment || `Apply here: ${SITE_URL} — takes 2 minutes.`;

  console.log('\n----- POST -----\n' + body + '\n----------------\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would post above content.');
    return;
  }

  // 6) Posting chain: Composio (company page) -> Zapier -> direct API
  if (process.env.COMPOSIO_API_KEY) {
    try {
      await createLinkedInPost({ text: body });
      await markPosted(slot, { angle: angleHint, firstLine: body.split('\n')[0], via: 'composio' });
      console.log('Done (via Composio).');
      return;
    } catch (err) {
      budget.recordFailure();
      console.error(`[WARN] Composio failed: ${err.message.slice(0, 180)} — trying Zapier`);
    }
  }

  if (ZAPIER_TOKEN) {
    try {
      await postToLinkedinViaZapier({ token: ZAPIER_TOKEN, text: body, pageId: process.env.LINKEDIN_PAGE_ID });
      await markPosted(slot, { angle: angleHint, firstLine: body.split('\n')[0], via: 'zapier' });
      console.log('Done (via Zapier).');
      return;
    } catch (err) {
      budget.recordFailure();
      console.error(`[WARN] Zapier failed: ${err.message.slice(0, 180)} — trying direct API`);
    }
  }

  try {
    const r = await postToLinkedinPageWithComment({ content: body, firstComment });
    await markPosted(slot, { angle: angleHint, firstLine: body.split('\n')[0], postId: r.postId, via: 'direct' });
    console.log(`Done. Post ID: ${r.postId}`);
  } catch (err) {
    budget.recordFailure();
    // Self-heal log: persist failure for inspection; exit non-zero so Actions shows it
    await fbPut(`linkedin/errors/${new Date().toISOString().slice(0, 10)}_${slot}`, {
      error: err.message.slice(0, 500), errorsSoFar: budget.count, at: new Date().toISOString(),
    }).catch(() => {});
    console.error(`[FAIL] all providers exhausted (${budget.count}/${budget.max} errors): ${err.message}`);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});

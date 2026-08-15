import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { callWithRetry } from './generator.js';
import { generateImageAndPost } from './instagram-poster.js';
import { hash, isDup } from './state.js';

const FIREBASE_URL = 'https://laptop-privacy-default-rtdb.firebaseio.com';
const IG_STATE_URL = `${FIREBASE_URL}/ig_state.json`;

async function loadIgState() {
  const res = await fetch(IG_STATE_URL);
  if (res.status === 404) return { previousPosts: [], postHashes: [], lastRun: null };
  const data = await res.json();
  return data || { previousPosts: [], postHashes: [], lastRun: null };
}

async function saveIgState(state) {
  await fetch(IG_STATE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

function extractHeadline(post) {
  return (post || '')
    .split('\n')
    .map(l => l.trim())
    .find(l => !l.startsWith('#') && l.length > 20) || 'Build Real Skills.';
}

function extractSubtext(post) {
  const lines = (post || '').split('\n').map(l => l.trim()).filter(l => l.length > 10);
  return lines.find(l => !l.startsWith('#') && l !== extractHeadline(post)) || 'Industry projects. Mentorship. A portfolio that proves you can build.';
}

const IG_CAPTION_PROMPT = `You write short, scannable Instagram captions for DEV/CRAFT — a virtual internship platform for Indian engineering students (MSME-registered, 10,000+ learners, from devcraft.fennark.xyz).

## HARD RULES — breaking any fails
- NEVER mention: jobs, placement, hiring, recruiters, employment, interviews, salaries, packages, career outcomes.
- NEVER claim certificate is recognized/accepted/valued by any employer/university/industry body.
- NEVER say "free", "paid", or any pricing/cost language ("100% free", "no cost", etc.).
- NEVER promise or imply job outcomes or third-party internships.
- NEVER write "industry-recognized".
- MAX 3 hashtags (#DevCraft #VirtualInternship + 1 relevant).
- NO engagement bait ("comment YES", "share if you agree").
- MAX 1 short Hinglish phrase max (English letters).

## STYLE
- 80-130 words. Short punchy lines, blank line between groups. Sounds human, sharp, senior-student tone.
- Always answer "What do I get by joining?" — real industry projects, instant offer letter, verified certificate, portfolio, mentorship.
- Every caption ends with: "Apply now → devcraft.fennark.xyz"
- Use faith-based hooks like "The hostel Wi-Fi finally cooperated...", project specifics, or a real student fear (empty resume, certificate-mill doubt). Be specific and credible — no generic filler.

## RESPONSE FORMAT
Respond with ONLY a JSON object — no reasoning, no drafts, no code fences. The very first character of your reply must be "{" followed by "caption". Example: {"caption":"text here"}`;

async function generateIgCaption(siteData, previousPosts, apiKey, model, feedback) {
  const feedbackHint = feedback ? `\n## FIX THIS: ${feedback}\n` : '';
  const siteFacts = JSON.stringify(siteData?.domainList || siteData?.pages?.domainList || siteData).slice(0, 2500);
  const prompt = `${IG_CAPTION_PROMPT}

SITE FACTS:
${siteFacts}${feedbackHint}

Prior posts (avoid repeating angles): ${(previousPosts || []).slice(-3).join(' || ').slice(0, 800)}

Write the caption now. Return ONLY the JSON.`;

  const raw = await callWithRetry(prompt, apiKey, model, 2048, true);
  if (!raw) throw new Error('Caption generation failed');
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!objMatch) throw new Error(`Invalid JSON from AI: ${cleaned.slice(0, 300)}`);
    try { parsed = JSON.parse(objMatch[0]); }
    catch { throw new Error(`Invalid JSON from AI: ${cleaned.slice(0, 300)}`); }
  }
  const caption = (parsed.caption || '').trim();
  if (!caption || caption.length < 30) throw new Error('Caption too short');
  return caption;
}

function ensureLink(text) {
  const site = 'devcraft.fennark.xyz';
  const trimmed = (text || '').trim();
  if (new RegExp(site.replace(/\./g, '\\.')).test(trimmed)) return trimmed;
  return trimmed ? `${trimmed}\n\nApply now: ${site}` : `Apply now: ${site}`;
}

function buildCaption(post) {
  const site = 'devcraft.fennark.xyz';
  let caption = (post || '')
    .replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, site)
    .slice(0, 2100);
  let hashtags = '';
  const m = caption.match(/(#\S+(\s+#\S+){0,4})$/);
  if (m) { hashtags = m[0]; caption = caption.slice(0, m.index).trim(); }
  caption = ensureLink(caption);
  if (hashtags) caption = `${caption}\n\n${hashtags}`;
  return caption;
}

async function main() {
  console.log(`\n═══ DEV/CRAFT Instagram Agent ═══\n${new Date().toISOString()}\n`);

  const state = await loadIgState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }

  console.log('[1/3] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  let caption;
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/3] Generating caption (attempt ${i + 1})...`);
    try {
      caption = await generateIgCaption(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
      caption = buildCaption(caption);
    } catch (err) {
      feedback = 'violation: ' + err.message.slice(0, 100);
      console.log(`      ${err.message}`);
      if (i < 4) console.log('      Retrying...\n');
      continue;
    }
    if (isDup(caption, state)) { console.log('      Duplicate, retry...\n'); continue; }
    if (caption.length < 10) { feedback = 'caption too short'; continue; }
    const lowered = caption.toLowerCase();
    if (/job|place|hire|recruit|employ|interview|salary|package|recogniz/i.test(lowered)) { feedback = 'banned word in caption'; continue; }
    postOk = true;
    break;
  }
  if (!postOk) { console.error('[!] No caption after 5 attempts'); process.exit(1); }

  console.log(`\n${caption}\n`);

  console.log('[3/3] Generating card + posting to Instagram...');
  const mediaId = await generateImageAndPost({
    post: caption,
    imageMeta: { headline: extractHeadline(caption), subtext: extractSubtext(caption), site: 'devcraft.fennark.xyz' },
    caption,
    apiKey: NVIDIA_API_KEY,
  });
  console.log(`      ✓ Published: ${mediaId}`);

  state.previousPosts.push(caption);
  state.postHashes.push(hash(caption.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveIgState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
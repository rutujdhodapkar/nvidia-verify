// DEV/CRAFT LinkedIn Automation — 3 posts/day targeted at engineering & CSE students
// Slots: morning (career/skills), afternoon (internship CTA), evening (projects/trends)
// Every post carries devcraft.fennark.xyz (body CTA + full link as first comment).
// Content: NVIDIA AI generation with curated fallbacks; theme rotation avoids repeats.

import { postToLinkedinViaZapier } from '../lib/zapier-mcp.js';
import { postToLinkedinPageWithComment } from './linkedin-poster.js';
import { pfGet as fbGet, pfPut as fbPut } from '../lib/portfolio-firebase.js';

const SITE_URL = process.env.SITE_URL || 'https://devcraft.fennark.xyz';
const LINK = 'devcraft.fennark.xyz';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const ZAPIER_TOKEN = process.env.ZAPIER_TOKEN;

// ---------- theme engine ----------
// Each slot has a rotation of angles; day-of-year picks which angle runs today.
const THEMES = {
  morning: [
    { id: 'skills', hook: 'skill-gap' },
    { id: 'myth', hook: 'cgpa-vs-skills' },
    { id: 'roadmap', hook: 'what-to-learn' },
    { id: 'habit', hook: 'daily-consistency' },
    { id: 'trend', hook: 'trending-tech' },
  ],
  afternoon: [
    { id: 'offer', hook: 'internship-open' },
    { id: 'certificate', hook: 'verified-certificate' },
    { id: 'flexible', hook: 'learn-at-your-pace' },
    { id: 'domains', hook: 'pick-your-domain' },
    { id: 'zero fee', hook: 'free-to-start' },
  ],
  evening: [
    { id: 'project', hook: 'build-in-public' },
    { id: 'placement', hook: 'placement-prep' },
    { id: 'ai', hook: 'ai-for-students' },
    { id: 'portfolio', hook: 'portfolio-power' },
    { id: 'community', hook: 'peer-learning' },
  ],
};

function dayOfYear() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  return Math.floor((now - start) / 86400000);
}

function slotFromArgOrTime() {
  const arg = process.argv.find(a => ['morning', 'afternoon', 'evening'].includes(a));
  if (arg) return arg;
  const istHour = (new Date().getUTCHours() + 5.5) % 24;
  if (istHour < 12) return 'morning';
  if (istHour < 17) return 'afternoon';
  return 'evening';
}

function pickTheme(slot) {
  const list = THEMES[slot];
  return list[(dayOfYear() * 3 + ['morning', 'afternoon', 'evening'].indexOf(slot)) % list.length];
}

// ---------- audience targeting ----------
const AUDIENCE = 'Indian engineering and CSE students (1st-4th year), active on LinkedIn, worried about placements, internships and resume-building';

const SYSTEM_PROMPT = `You write LinkedIn posts for DevCraft, a virtual internship platform by Fennark (${SITE_URL}).
Audience: ${AUDIENCE}.
Rules:
- 80-140 words. Short punchy lines. Line breaks between ideas.
- Hook in the first line (no hashtags in line 1).
- Relatable student pain or aspiration -> insight -> soft CTA mentioning ${LINK}.
- 3-5 hashtags at the end (#EngineeringStudents #CSE #Internship style).
- No emojis spam: max 2-3 emojis total. No false claims (no "guaranteed job").
- Output ONLY the post text.`;

const USER_PROMPTS = {
  skills: 'Write about the #1 skill CSE students should build this semester beyond the syllabus, and why projects beat marks.',
  myth: 'Debunk the myth that CGPA alone gets you placed. Skills + proof of work win. End with soft CTA to devcraft.fennark.xyz.',
  roadmap: 'Give a crisp 90-day learning roadmap for an engineering student aiming for software internships.',
  habit: 'Explain how 1 focused hour daily beats weekend cramming for engineering students building careers.',
  trend: 'Explain one trending tech (AI agents, cloud, web dev) in simple terms and why students should touch it now.',
  offer: 'Announce that DevCraft virtual internships are open: real tasks, mentor reviews, verified certificate. Strong CTA.',
  certificate: 'Why a verified internship certificate with real project evidence stands out on a fresher resume.',
  flexible: 'Pitch a fully virtual, learn-at-your-pace internship that fits around college classes.',
  domains: 'List exciting internship domains students can pick (AI, web, cloud, design, data) — help them choose.',
  'zero fee': 'Highlight zero application friction: free to start, no hidden charges, straight to real tasks.',
  project: 'Suggest one impressive beginner-friendly project idea for CS students and how it impresses recruiters.',
  placement: 'Placement season reality check: what interviewers actually ask vs what students prepare.',
  ai: 'How engineering students from any branch can start using AI tools properly to 10x their learning.',
  portfolio: 'Your GitHub/portfolio is your real resume. How to make yours speak before HR ever calls.',
  community: 'The power of learning in public and peer communities for engineering students.',
};

// ---------- content generation ----------
async function generatePost(slot) {
  const theme = pickTheme(slot);
  console.log(`[THEME] slot=${slot} id=${theme.id}`);

  let text = null;
  if (NVIDIA_KEY && !process.env.NO_AI) {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${NVIDIA_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: NVIDIA_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `${USER_PROMPTS[theme.id]}\n\nAngle: ${theme.hook}. Today's date: ${new Date().toISOString().slice(0, 10)}.` },
          ],
          max_tokens: 400,
          temperature: 0.9,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        text = data?.choices?.[0]?.message?.content?.trim() || null;
        if (text) console.log('[AI] generated via NVIDIA');
      } else {
        console.log(`[AI] NVIDIA failed ${res.status}, using fallback`);
      }
    } catch (err) {
      console.log(`[AI] NVIDIA error: ${err.message.slice(0, 120)}, using fallback`);
    }
  }

  if (!text) text = fallbackPost(theme.id);
  return { text, theme };
}

// Curated fallbacks — still high quality, rotated by theme
function fallbackPost(id) {
  const map = {
    skills: `Your syllabus won't get you placed.\n\nRecruiters spend 6 seconds on your resume. They look for projects, not marks.\n\nOne real deployed project > ten theoretical subjects.\n\nStart building today at ${LINK} — virtual internships with real tasks and mentor reviews.\n\n#EngineeringStudents #CSE #Internship #PlacementPrep`,
    myth: `Myth: "9+ CGPA guarantees placement."\n\nReality: interviews test what you've BUILT, not memorized.\n\nEvery shortlisted candidate had proof of work — projects, internships, deployments.\n\nDon't wait for final year. Start collecting proof now → ${LINK}\n\n#CSE #PlacementSeason #EngineeringStudents #Internship`,
    roadmap: `90 days to become internship-ready:\n\nMonth 1: Pick ONE stack. Build basics daily.\nMonth 2: Ship 2 small projects. Put them on GitHub.\nMonth 3: Join a structured internship, get mentor feedback + certificate.\n\nMost students skip month 3 — that's the mistake.\n\nVirtual internships open now: ${LINK}\n\n#EngineeringStudents #CSE #90DaysChallenge #Internship`,
    habit: `1 hour daily > 10 hours on Sunday.\n\nConsistency compounds. A single focused hour, every day, for 90 days = a portfolio that speaks in interviews.\n\nStructured tasks make consistency easy: ${LINK}\n\n#CSE #StudentLife #EngineeringStudents #Consistency`,
    trend: `AI isn't replacing engineers.\nEngineers who USE AI are replacing those who don't.\n\nYou don't need a PhD. You need hands-on reps: build with the tools, break them, ship something real.\n\nGet guided AI project experience → ${LINK}\n\n#AI #EngineeringStudents #CSE #FutureReady`,
    offer: `Virtual internships — applications OPEN.\n\nWhat you get:\n• Real industry-style tasks\n• Mentor code/design reviews\n• Verified completion certificate\n• Fully remote, college-friendly timelines\n\nDomains: AI, Web Dev, Cloud, Data, Design.\n\nApply in 2 minutes → ${LINK}\n\n#Internship #EngineeringStudents #CSE #Hiring`,
    certificate: `"Certificate ho toh chalega?"\nNo. Certificate + EVIDENCE chalega.\n\nHR doesn't trust PDFs anymore. They click links, check GitHub, read your project write-ups.\n\nDevCraft internships end with a verified certificate AND a project trail you can show.\n\nStart here → ${LINK}\n\n#ResumeTips #CSE #EngineeringStudents #Internship`,
    flexible: `College 9-4. Commute 2 hrs. When exactly do you "gain experience"?\n\nAnswer: internships built around YOUR schedule.\n• Async tasks\n• Weekly mentor checkpoints\n• No fixed office hours\n\nThat's the whole point of DevCraft's virtual internship model.\n\nSee how it fits: ${LINK}\n\n#StudentLife #Internship #EngineeringStudents #CSE`,
    domains: `"Which domain should I choose?" — the most asked DM we get.\n\nQuick guide:\n🤖 AI/ML — if you like math + magic\n🌐 Web Dev — fastest visible progress\n☁️ Cloud — highest demand, least competition\n📊 Data — if patterns excite you\n🎨 Design — if you think in visuals\n\nTry one risk-free → ${LINK}\n\n#CareerGuide #CSE #EngineeringStudents #Internship`,
    'zero fee': `No fees. No catch. Just tasks.\n\nMost platforms gatekeep "opportunities" behind paywalls. We did the opposite — apply free, get real tasks, earn a verified certificate.\n\nYour effort is the only investment.\n\nStart now → ${LINK}\n\n#StudentsFirst #Internship #EngineeringStudents #CSE`,
    project: `Project idea that beats "todo app" on your resume:\n\nAn AI-powered resume reviewer — upload PDF, get section-wise feedback.\n\nYou'll touch: parsing, APIs, prompt engineering, deployment.\n\nWant more structured projects with mentor reviews? That's literally our internship format → ${LINK}\n\n#ProjectIdeas #CSE #EngineeringStudents #BuildInPublic`,
    placement: `What students prepare: DP, puzzles, 300 LeetCode problems.\nWhat interviewers ask: "Walk me through YOUR project."\n\nBoth matter. But most students have nothing solid for question #2.\n\nFix that gap with real internship projects → ${LINK}\n\n#PlacementSeason #InterviewPrep #CSE #EngineeringStudents`,
    ai: `Use AI to LEARN, not to cheat.\n\n❌ "Write my assignment"\n✅ "Explain this concept 3 ways"\n✅ "Review my code like a senior dev"\n✅ "Quiz me on OS concepts"\n\nStudents who master AI workflows now will dominate placements in 2 years.\n\nLearn by building with AI → ${LINK}\n\n#AITools #EngineeringStudents #CSE #Learning`,
    portfolio: `Your resume: 1 page.\nYour portfolio: unlimited depth.\n\nGitHub streaks, live demo links, write-ups — these close offers before HR even calls.\n\nNeed projects worth showcasing? Structured internship tasks → ${LINK}\n\n#Portfolio #GitHub #CSE #EngineeringStudents`,
    community: `Solo grinding is slow.\n\nPeer learning is the cheat code: share progress publicly, get feedback fast, stay accountable.\n\nOur interns build together, review each other's work, and grow twice as fast.\n\nJoin the cohort → ${LINK}\n\n#PeerLearning #EngineeringStudents #CSE #Community`,
  };
  return map[id] || map.skills;
}

// ---------- state (avoid duplicate topic same day) ----------
async function alreadyPostedToday(slot) {
  const key = `linkedin/posts/${new Date().toISOString().slice(0, 10)}_${slot}`;
  const rec = await fbGet(key);
  return !!rec;
}

async function markPosted(slot, meta) {
  await fbPut(`linkedin/posts/${new Date().toISOString().slice(0, 10)}_${slot}`, { ...meta, postedAt: new Date().toISOString() });
}

// ---------- main ----------
async function main() {
  const slot = slotFromArgOrTime();
  console.log(`=== LinkedIn Automation ${new Date().toISOString()} ===`);
  console.log(`Slot: ${slot} | DRY_RUN=${DRY_RUN}\n`);

  if (!DRY_RUN && !ZAPIER_TOKEN && !process.env.LINKEDIN_CLIENT_ID) {
    console.error('Missing posting credentials — set ZAPIER_TOKEN or LINKEDIN_CLIENT_ID/SECRET/REFRESH_TOKEN');
    process.exit(1);
  }

  if (await alreadyPostedToday(slot)) {
    console.log(`Already posted for slot "${slot}" today. Skipping.`);
    return;
  }

  const { text, theme } = await generatePost(slot);

  // Enforce site presence: plain-domain CTA in body (no ugly full URL), full link in first comment
  let body = text;
  if (!body.toLowerCase().includes('devcraft.fennark.xyz')) {
    body += `\n\nExplore: ${LINK}`;
  }
  const firstComment = `Apply here: ${SITE_URL} — takes 2 minutes. Virtual internship, real tasks, verified certificate.`;

  console.log('\n----- POST -----\n' + body + '\n----------------\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would post above content.');
    return;
  }

  // Primary: Zapier MCP (no OAuth expiry). Fallback: direct LinkedIn API.
  if (ZAPIER_TOKEN) {
    try {
      await postToLinkedinViaZapier({ token: ZAPIER_TOKEN, text: body, pageId: process.env.LINKEDIN_PAGE_ID });
      await markPosted(slot, { theme: theme.id, hook: theme.hook, via: 'zapier' });
      console.log('Done (via Zapier).');
      return;
    } catch (err) {
      console.error(`[WARN] Zapier failed: ${err.message.slice(0, 200)} — falling back to direct API`);
    }
  }

  try {
    const result = await postToLinkedinPageWithComment({ content: body, firstComment });
    await markPosted(slot, { theme: theme.id, hook: theme.hook, postId: result.postId, commentAdded: result.commentAdded });
    console.log(`Done. Post ID: ${result.postId}`);
  } catch (err) {
    console.error(`[FAIL] ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

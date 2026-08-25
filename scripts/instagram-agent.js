import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { callWithRetry } from './generator.js';
import { uploadToGithub, postToInstagramReel, postToInstagramCarousel } from './instagram-poster.js';
import { hash, isDup } from './state.js';

const FIREBASE_URL = 'https://laptop-privacy-default-rtdb.firebaseio.com';
const IG_STATE_URL = `${FIREBASE_URL}/ig_state.json`;
const APPLE_CHART_URL = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/50/songs.json';

async function loadIgState() {
  const res = await fetch(IG_STATE_URL);
  if (res.status === 404) return { previousPosts: [], postHashes: [], lastRun: null };
  const data = await res.json();
  return data || { previousPosts: [], postHashes: [], lastRun: null };
}

async function fetchLatestEnglishSong() {
  try {
    // Wide pool of current hits (50) + deterministic rotation so every post
    // (morning/evening, day to day) features a different trending English song.
    const res = await fetch(APPLE_CHART_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`chart ${res.status}`);
    const data = await res.json();
    let results = data?.feed?.results || [];

    let candidates = results.filter(r => r.kind === 'songs' && r.contentAdvisoryRating !== 'Explicit');
    if (candidates.length === 0) candidates = results.filter(r => r.kind === 'songs');
    if (candidates.length === 0) candidates = results;
    if (candidates.length === 0) return null;

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
    const doy = Math.floor((now - start) / 86400000);
    const istHour = (now.getUTCHours() + 5.5) % 24;
    const slot = istHour < 12 ? 0 : 1;

    // Rotate through the chart; step 7 keeps morning/evening picks far apart
    const idx = (doy * 2 + slot * 7) % candidates.length;
    for (let i = 0; i < candidates.length; i++) {
      const pick = candidates[(idx + i) % candidates.length];
      if (pick?.name) return { title: pick.name, artist: pick.artistName };
    }
    return null;
  } catch (err) {
    console.warn(`      ⚠ Could not fetch latest song chart: ${err.message}`);
    return null;
  }
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

const IG_CAPTION_PROMPT = `You write short, scroll-stopping Instagram captions for DEV/CRAFT — a virtual internship platform for Indian engineering students (MSME-registered, 10,000+ learners, from devcraft.fennark.xyz).

## HARD RULES — breaking any fails
- NEVER mention: jobs, placement, hiring, recruiters, employment, interviews, salaries, packages, career outcomes.
- NEVER claim certificate is recognized/accepted/valued by any employer/university/industry body.
- NEVER say "free", "paid", or any pricing/cost language ("100% free", "no cost", etc.).
- NEVER promise or imply job outcomes or third-party internships.
- NEVER write "industry-recognized".
- MAX 3 hashtags (#DevCraft #VirtualInternship + 1 relevant).
- MAX 2 short Hinglish phrases max (English letters), kept light and natural.
- Max 2 emoji, all inside the body (never on the URL line).

## STRUCTURE (5 short blocks, blank line between)
- HOOK: First line under 25 words, a bold specific claim or a student's real feeling — never "Are you...?" or a greeting.
- LINK: IMMEDIATELY after the hook, put the full URL on its own line: "Apply now → https://devcraft.fennark.xyz" — so it's visible in the feed preview without tapping "more".
- STORY: One concrete student moment (hostel Wi-Fi, empty resume fear, the first PR, a proud parent call). Credible, sensory, real.
- VALUE: "What you get" in 3 short bullet-ish lines, plain text: real industry projects, instant offer letter, verified certificate, mentorship.
- ASK + SHARE: ends with one short line that nudges sharing naturally (not bait): e.g. "Send this to your hostel group chat — they're stuck on the same thing." or "Forward it to the friend who keeps asking what you're building." then "Apply now → https://devcraft.fennark.xyz"

## STYLE
- 70-120 words total (aim ~95). Sounds human, sharp, senior-student tone. No corporate speak, no emoji spam.
- Rotate angle each time: exams/college pressure, parental pride, hostel scene, cert-mill doubt, college-fest hype, budget-conscious student — pick ONE that fits the SITE FACTS, avoid repeating the angle from prior posts.
- Be specific and credible — name a concrete project type or skill. No generic filler like "amazing opportunity".

## CARD HEADLINE (separate from caption)
- A bold poster title for the image card: 4-8 words, punchy, specific, high-impact.
- Statement, not a question. No hashtags, no emoji, no period at the end. Say "Build a Portfolio That Wins" or "Ship Real Projects, Not Tutorials" — never a greeting or generic tagline.
- Must make a student stop scrolling on the feed at a glance.
- NEVER reference jobs, hiring, placement, careers, salaries, or job outcomes.

## RESPONSE FORMAT
Respond with ONLY a JSON object — no reasoning, no drafts, no code fences. Do NOT repeat or summarize these instructions. Do NOT explain anything. Your reply must START with "{". Include an original "headline" (4-8 words, no period) and a "caption" (the 5 blocks separated with \\n\\n). Write both in your own words — never echo placeholder labels like "Story line". Behave like an API endpoint that answers with exactly one JSON object and nothing else.`;

async function generateIgCaption(siteData, previousPosts, apiKey, model, feedback) {
  const feedbackHint = feedback ? `\n## FIX THIS: ${feedback}\n` : '';
  const home = siteData?.pages?.['/'];
  const phrases = (siteData?.summary?.keyPhrases || []).join(' | ').slice(0, 400);
  const homeText = (home?.textContent || '').slice(0, 1600);
  const siteFacts = `Title: ${siteData?.summary?.title || ''}
Key phrases: ${phrases || 'virtual internship, real projects'}
Home page: ${homeText}`;
  const prompt = `${IG_CAPTION_PROMPT}

SITE FACTS:
${siteFacts}${feedbackHint}

Prior posts (avoid repeating angles): ${(previousPosts || []).slice(-3).join(' || ').slice(0, 800)}

Write the headline + caption now. Return ONLY the JSON.`;

  const raw = await callWithRetry(prompt, apiKey, model, 8192, true, { temperature: 0.4 });
  if (!raw) throw new Error('Caption generation failed');
  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch {
    // Model often reasons out loud before JSON — pull the LAST {key:...} block containing "caption".
    const lastIdx = cleaned.lastIndexOf('"caption"');
    if (lastIdx > -1) {
      const open = cleaned.lastIndexOf('{', lastIdx);
      let close = -1;
      for (let i = lastIdx; i < cleaned.length; i++) {
        if (cleaned[i] === '}') { close = i; break; }
      }
      if (open > -1 && close > open) {
        try { parsed = JSON.parse(cleaned.slice(open, close + 1)); }
        catch { parsed = null; }
      }
    }
    if (!parsed) throw new Error(`Invalid JSON from AI: ${cleaned.slice(0, 300)}`);
  }
  const caption = (parsed.caption || '').trim();
  if (!caption || caption.length < 30) throw new Error('Caption too short');
  if (caption.split(/\s+/).length < 50) throw new Error('Caption under 50 words');
  if (/\bHOOK line\b|\bStory line\b|\bValue lines\b/.test(caption)) throw new Error('Caption echoed example placeholders');
  const headline = (parsed.headline || '').trim().replace(/\.$/, '');
  if (!headline || headline.split(/\s+/).length < 3 || headline.split(/\s+/).length > 9) throw new Error('Headline wrong length');
  if (hasBannedWords(headline)) throw new Error('Headline has banned word');
  return { caption, headline };
}

const BANNED_WORDS = /\b(placement|placements|recruit(er|ers|ing|ment)?s?|employ(er|ers|ee|ees|ment|ing|ed)?\b|hir(ing|ed|es|e)|job(s)?|interview(s|ed|ing)?|salar(y|ies)|package(s)?|recogni(s|z)ed|free|paid|cost(s|ing)?)\b/i;

function hasBannedWords(text) {
  return BANNED_WORDS.test((text || '').toLowerCase());
}

function buildFallbackCaption(siteData) {
  const safePhrases = (siteData?.summary?.keyPhrases || []).filter(p => !hasBannedWords(p)).slice(0, 3).join(', ');
  const story = 'A final-year student finished a real project in 6 weeks and finally had something to show for all the late nights.';
  return buildCaption(`Stop scrolling past this one.

Apply now → https://devcraft.fennark.xyz

${story}

Real industry projects. Instant offer letter. Verified certificate. Mentorship from engineers. ${safePhrases}.

Send this to your hostel group chat — they're stuck on the same thing.

Apply now → https://devcraft.fennark.xyz`);
}

function ensureLink(text) {
  const site = 'devcraft.fennark.xyz';
  const trimmed = (text || '').trim();
  if (new RegExp(site.replace(/\./g, '\\.')).test(trimmed)) return trimmed;
  return trimmed ? `${trimmed}\n\nApply now: https://devcraft.fennark.xyz` : `Apply now: https://devcraft.fennark.xyz`;
}

function buildCaption(post) {
  let caption = (post || '')
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

  console.log('      Fetching latest English song...');
  const latestSong = await fetchLatestEnglishSong();
  if (latestSong) console.log(`      ✓ Song: ${latestSong.title} — ${latestSong.artist}`);

  let caption;
  let headline = '';
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 7; i++) {
    console.log(`[2/3] Generating caption + headline (attempt ${i + 1})...`);
    try {
      const r = await generateIgCaption(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
      caption = buildCaption(r.caption);
      headline = r.headline;
    } catch (err) {
      feedback = 'violation: ' + err.message.slice(0, 100);
      console.log(`      ${err.message}`);
      if (i < 6) console.log('      Retrying...\n');
      continue;
    }
    if (isDup(caption, state)) { console.log('      Duplicate, retry...\n'); continue; }
    if (caption.length < 10) { feedback = 'caption too short'; continue; }
    if (hasBannedWords(caption)) { feedback = 'banned word in caption'; continue; }
    postOk = true;
    break;
  }
  if (!postOk) {
    caption = buildFallbackCaption(siteData);
    headline = extractHeadline(caption);
    if (isDup(caption, state)) {
      caption = buildCaption(`Real projects beat 100 tutorials. Apply now → https://devcraft.fennark.xyz\n\n6-week virtual internship. Offer letter + verified certificate. Mentorship.\n\nSend this to a friend stuck on tutorials.`);
      headline = 'Ship Real Projects, Not Tutorials';
    }
    postOk = true;
    console.log('      ✓ Using fallback caption (model kept failing)');
  }

  console.log(`HEADLINE: ${headline}\n`);
  console.log(`\n${caption}\n`);

  console.log('[3/3] Generating cards + posting to Instagram...');
  const { generateDesignerCards } = await import('./designer.js');
  const imageMeta = {
    headline: headline || extractHeadline(caption),
    subtext: extractSubtext(caption),
    site: 'devcraft.fennark.xyz',
  };
  const { cards, themeName, postType } = await generateDesignerCards({
    post: caption,
    caption,
    imageMeta,
    count: 3,
    previousTheme: state.lastTheme || null,
    format: 'reel',
  });

  console.log(`      Theme: ${themeName} · post type: ${postType}`);

  let mediaId;
  try {
    const { renderReel } = await import('./reel-renderer.js');
    const reel = await renderReel({ cards, song: latestSong, caption });
    const videoUrl = await uploadToGithub(reel.buffer, 'mp4', 'video/mp4', 0);
    const coverUrl = await uploadToGithub(cards[0], 'png', 'image/png', 1);
    mediaId = await postToInstagramReel({ videoUrl, caption, coverUrl });
    console.log(`      ✓ Reel published (${latestSong ? `audio: ${latestSong.title} — ${latestSong.artist}` : 'no audio'}) — the song name stays out of the caption and cards: ${mediaId}`);
  } catch (err) {
    console.log(`      ⚠ Reel failed (${err.message.slice(0, 150)}) — falling back to photo carousel`);
    const imageUrls = [];
    for (let i = 0; i < cards.length; i++) {
      imageUrls.push(await uploadToGithub(cards[i], 'png', 'image/png', i));
    }
    mediaId = await postToInstagramCarousel({ imageUrls, caption });
    console.log(`      ✓ Carousel published (${imageUrls.length} images): ${mediaId}`);
  }

  state.previousPosts.push(caption);
  state.postHashes.push(hash(caption.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastTheme = themeName;
  state.lastRun = new Date().toISOString();
  await saveIgState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { callWithRetry } from './generator.js';
import { uploadToGithub, postToInstagram, postToInstagramReel } from './instagram-poster.js';
import { hash, isDup } from './state.js';

const FIREBASE_URL = 'https://laptop-privacy-default-rtdb.firebaseio.com';
const IG_STATE_URL = `${FIREBASE_URL}/ig_state.json`;
const APPLE_CHART_URL = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json';

async function loadIgState() {
  const res = await fetch(IG_STATE_URL);
  if (res.status === 404) return { previousPosts: [], postHashes: [], lastRun: null };
  const data = await res.json();
  return data || { previousPosts: [], postHashes: [], lastRun: null };
}

async function fetchLatestEnglishSong() {
  try {
    const res = await fetch(APPLE_CHART_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`chart ${res.status}`);
    const data = await res.json();
    const results = data?.feed?.results || [];
    const top = results.find(r => r.kind === 'songs' && r.contentAdvisoryRating !== 'Explicit') || results.find(r => r.kind === 'songs') || results[0];
    if (!top?.name) return null;
    return { title: top.name, artist: top.artistName };
  } catch (err) {
    console.warn(`      ⚠ Could not fetch latest song chart: ${err.message}`);
    return null;
  }
}

async function fetchSongPreviewUrl(title, artist) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`itunes ${res.status}`);
    const data = await res.json();
    const track = data?.results?.[0];
    if (!track?.previewUrl) return null;
    return track.previewUrl;
  } catch (err) {
    console.warn(`      ⚠ Could not fetch song preview: ${err.message}`);
    return null;
  }
}

async function buildReelVideo(imageBuffer, audioUrl) {
  const os = await import('os');
  const path = await import('path');
  const fs = await import('fs');
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ig-reel-'));
  const imgPath = path.join(tmpDir, 'card.png');
  const audioPath = path.join(tmpDir, 'song.m4a');
  const videoPath = path.join(tmpDir, 'reel.mp4');
  try {
    await fs.promises.writeFile(imgPath, imageBuffer);
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(30000) });
    if (!audioRes.ok) throw new Error(`audio ${audioRes.status}`);
    await fs.promises.writeFile(audioPath, Buffer.from(await audioRes.arrayBuffer()));
    console.log('      Rendering reel (image + song audio) with ffmpeg...');
    await execFileAsync('ffmpeg', [
      '-y', '-loop', '1', '-i', imgPath, '-i', audioPath,
      '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k',
      '-pix_fmt', 'yuv420p', '-shortest', '-movflags', '+faststart', videoPath,
    ], { timeout: 60000 });
    const buf = await fs.promises.readFile(videoPath);
    console.log(`      ✓ Reel video rendered (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
    return buf;
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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
- NO engagement bait ("comment YES", "share if you agree").
- MAX 1 short Hinglish phrase max (English letters).

## STRUCTURE (5 short blocks, blank line between)
- HOOK: First line under 30 words, a bold specific claim or a student's real feeling — never "Are you...?" or a greeting.
- STORY: One concrete student moment (hostel Wi-Fi, empty resume fear, the first PR, a proud parent call). Credible, sensory, real.
- VALUE: "What you get" in 3 short bullet-ish lines, plain text: real industry projects, instant offer letter, verified certificate, mentorship.
- SONG: One line with the LATEST trending English song (title — artist) given in SITE FACTS, written naturally like "🎵 {song} — the hit of the season, press play and build". Max 1 line, no explicit content.
- ASK: ends with "Apply now → https://devcraft.fennark.xyz"

## STYLE
- 90-140 words total (aim ~110). Sounds human, sharp, senior-student tone. No corporate speak, no emoji spam (max 2 emoji — one in the hook, one on the SONG line).
- Rotate angle each time: exams/college pressure, parental pride, hostel scene, cert-mill doubt, college-fest hype, budget-conscious student — pick ONE that fits the SITE FACTS, avoid repeating the angle from prior posts.
- Be specific and credible — name a concrete project type or skill. No generic filler like "amazing opportunity".

## CARD HEADLINE (separate from caption)
- A bold poster title for the image card: 4-8 words, punchy, specific, high-impact.
- Statement, not a question. No hashtags, no emoji, no period at the end. Say "Build a Portfolio That Wins" or "Ship Real Projects, Not Tutorials" — never a greeting or generic tagline.
- Must make a student stop scrolling on the feed at a glance.
- NEVER reference jobs, hiring, placement, careers, salaries, or job outcomes.

## RESPONSE FORMAT
Respond with ONLY a JSON object — no reasoning, no drafts, no code fences. Do NOT repeat or summarize these instructions. Do NOT explain anything. Your reply must START with "{". Include an original "headline" (4-8 words, no period) and a "caption" (the 5 blocks separated with \\n\\n). Write both in your own words — never echo placeholder labels like "Story line". Behave like an API endpoint that answers with exactly one JSON object and nothing else.`;

async function generateIgCaption(siteData, previousPosts, apiKey, model, feedback, song) {
  const feedbackHint = feedback ? `\n## FIX THIS: ${feedback}\n` : '';
  const home = siteData?.pages?.['/'];
  const phrases = (siteData?.summary?.keyPhrases || []).join(' | ').slice(0, 400);
  const homeText = (home?.textContent || '').slice(0, 1600);
  const songHint = song
    ? `\nLatest trending English song for the SONG line: ${song.title} — ${song.artist}\n`
    : '\n(No chart available — invent a believable, current-sounding English song title.)\n';
  const siteFacts = `Title: ${siteData?.summary?.title || ''}
Key phrases: ${phrases || 'virtual internship, real projects'}
Home page: ${homeText}${songHint}`;
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
  if (caption.split(/\s+/).length < 80) throw new Error('Caption under 80 words');
  if (/\bHOOK line\b|\bStory line\b|\bValue lines\b/.test(caption)) throw new Error('Caption echoed example placeholders');
  const headline = (parsed.headline || '').trim().replace(/\.$/, '');
  if (!headline || headline.split(/\s+/).length < 3 || headline.split(/\s+/).length > 9) throw new Error('Headline wrong length');
  if (/job|place|hire|recruit|employ|interview|salary|package|recogniz|free|paid|cost/i.test(headline)) throw new Error('Headline has banned word');
  return { caption, headline };
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
  let songPreviewUrl = null;
  if (latestSong) {
    songPreviewUrl = await fetchSongPreviewUrl(latestSong.title, latestSong.artist);
    if (songPreviewUrl) console.log('      ✓ Song audio preview found');
  }

  let caption;
  let headline = '';
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/3] Generating caption + headline (attempt ${i + 1})...`);
    try {
      const r = await generateIgCaption(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback, latestSong);
      caption = buildCaption(r.caption);
      headline = r.headline;
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

  console.log(`HEADLINE: ${headline}\n`);
  console.log(`\n${caption}\n`);

  console.log('[3/3] Generating card + posting to Instagram...');
  const { generateImage } = await import('./image-gen.js');
  const imgBuf = await generateImage({
    post: caption,
    imageMeta: { headline: headline || extractHeadline(caption), subtext: extractSubtext(caption), site: 'devcraft.fennark.xyz' },
    apiKey: NVIDIA_API_KEY,
    format: 'portrait',
  });

  let mediaId;
  if (songPreviewUrl) {
    try {
      const videoBuf = await buildReelVideo(imgBuf, songPreviewUrl);
      const videoUrl = await uploadToGithub(videoBuf, 'mp4', 'video/mp4');
      const imageUrl = await uploadToGithub(imgBuf, 'png', 'image/png');
      mediaId = await postToInstagramReel({ videoUrl, caption, coverUrl: imageUrl });
      console.log(`      ✓ Reel published with song audio: ${mediaId}`);
    } catch (err) {
      console.log(`      ⚠ Reel with song failed (${err.message.slice(0, 150)}) — falling back to photo`);
      const imageUrl = await uploadToGithub(imgBuf, 'png', 'image/png');
      mediaId = await postToInstagram({ imageUrl, caption });
      console.log(`      ✓ Photo published: ${mediaId}`);
    }
  } else {
    const imageUrl = await uploadToGithub(imgBuf, 'png', 'image/png');
    mediaId = await postToInstagram({ imageUrl, caption });
    console.log(`      ✓ Photo published (no song audio available): ${mediaId}`);
  }

  state.previousPosts.push(caption);
  state.postHashes.push(hash(caption.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveIgState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
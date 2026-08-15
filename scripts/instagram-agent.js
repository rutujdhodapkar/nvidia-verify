import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { generatePost } from './generator.js';
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

async function main() {
  console.log(`\n═══ DEV/CRAFT Instagram Agent ═══\n${new Date().toISOString()}\n`);

  const state = await loadIgState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }

  console.log('[1/3] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  let post;
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/3] Generating post (attempt ${i + 1})...`);
    try {
      const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
      post = r.post;
    } catch (err) {
      feedback = 'violation: ' + err.message.slice(0, 100);
      console.log(`      ${err.message}`);
      if (i < 4) console.log('      Retrying...\n');
      continue;
    }
    if (isDup(post, state)) { console.log('      Duplicate, retry...\n'); continue; }
    if (post.length < 10) { feedback = 'post too short'; continue; }
    postOk = true;
    break;
  }
  if (!postOk) { console.error('[!] No post after 5 attempts'); process.exit(1); }

  const caption = post
    .replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz')
    .slice(0, 2200);
  console.log(`\n${caption}\n`);

  console.log('[3/3] Generating card + posting to Instagram...');
  const mediaId = await generateImageAndPost({
    post,
    imageMeta: { headline: extractHeadline(post), subtext: extractSubtext(post) },
    caption,
    apiKey: NVIDIA_API_KEY,
  });
  console.log(`      ✓ Published: ${mediaId}`);

  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveIgState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
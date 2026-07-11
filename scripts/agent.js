import 'dotenv/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync, createHash } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeSite } from './scraper.js';
import { generatePost } from './generator.js';
import { generateImage } from './image-gen.js';
import { postToLinkedin } from './poster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'data', 'state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) return { previousPosts: [], postHashes: [], lastRun: null };
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(s) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function contentHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); hash = ((hash << 5) - hash) + c; hash |= 0; }
  return hash.toString(16);
}

function isDuplicate(post, state) {
  const hash = contentHash(post.slice(0, 100));
  if (state.postHashes.includes(hash)) return true;
  for (const prev of state.previousPosts) {
    const overlap = [...post.matchAll(/\b\w+\b/g)].map(m => m[0].toLowerCase());
    const prevWords = [...prev.matchAll(/\b\w+\b/g)].map(m => m[0].toLowerCase());
    const common = overlap.filter(w => prevWords.includes(w)).length;
    if (common / Math.min(overlap.length, prevWords.length) > 0.6) return true;
  }
  return false;
}

async function main() {
  console.log(`\n═══ DEV/CRAFT LinkedIn Agent ═══`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const state = loadState();
  const {
    NVIDIA_API_KEY, NVIDIA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b',
    LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN,
    LINKEDIN_PAGE_ID, HF_API_TOKEN,
  } = process.env;

  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) { console.error('[!] Missing LINKEDIN_CLIENT_ID / SECRET'); process.exit(1); }
  if (!LINKEDIN_REFRESH_TOKEN) { console.error('[!] Missing LINKEDIN_REFRESH_TOKEN'); process.exit(1); }

  console.log('[1/4] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages, ${siteData.theme?.primary}\n`);

  let post, imageMeta, theme;
  for (let attempt = 0; attempt < 5; attempt++) {
    console.log(`[2/4] Generating post (attempt ${attempt + 1})...`);
    const result = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL);
    post = result.post;
    imageMeta = result.imageMeta;
    theme = result.theme;

    if (!isDuplicate(post, state)) break;
    console.log(`      ⚠ Duplicate detected, regenerating...\n`);
  }

  if (isDuplicate(post, state)) {
    console.error('[!] Could not generate unique post after 5 attempts');
    process.exit(1);
  }

  console.log(`      "${post.slice(0, 90)}..."\n`);

  console.log('[3/4] Generating image...');
  let imageBuffer = null;
  try { imageBuffer = await generateImage(post, theme, imageMeta, HF_API_TOKEN); } catch (err) { console.log(`      Image skipped: ${err.message}`); }

  console.log('\n[4/4] Posting to LinkedIn...');
  await postToLinkedin({
    content: post,
    imageBuffer,
    refreshToken: LINKEDIN_REFRESH_TOKEN,
    clientId: LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    pageId: LINKEDIN_PAGE_ID || null,
  });

  state.previousPosts.push(post);
  state.postHashes.push(contentHash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

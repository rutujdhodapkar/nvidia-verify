import 'dotenv/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeSite } from './scraper.js';
import { generatePost } from './generator.js';
import { generateImage } from './image-gen.js';
import { postToLinkedin } from './poster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'data', 'state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) return { previousPosts: [], lastRun: null };
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(s) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

async function main() {
  console.log(`\n═══ DEV/CRAFT LinkedIn Agent ═══`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  const state = loadState();
  const {
    NVIDIA_API_KEY,
    NVIDIA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b',
    LINKEDIN_EMAIL,
    LINKEDIN_PASSWORD,
  } = process.env;

  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }
  if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD) { console.error('[!] Missing LINKEDIN credentials'); process.exit(1); }

  /* ── 1. SCRAPE ── */
  console.log('[1/4] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages, theme: ${siteData.theme?.primary}\n`);

  /* ── 2. GENERATE POST ── */
  console.log('[2/4] Generating post (NVIDIA nemotron)...');
  const { post, imageMeta, theme } = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL);
  console.log(`      "${post.slice(0, 90)}..."\n`);

  /* ── 3. GENERATE IMAGE ── */
  console.log('[3/4] Generating image (Pollinations.ai)...');
  let imageBuffer = null;
  try {
    imageBuffer = await generateImage(post, theme, imageMeta);
  } catch (err) {
    console.log(`      Image gen skipped: ${err.message}`);
  }

  /* ── 4. POST TO LINKEDIN ── */
  console.log('\n[4/4] Posting to LinkedIn...');
  await postToLinkedin({
    content: post,
    imageBuffer,
    email: LINKEDIN_EMAIL,
    password: LINKEDIN_PASSWORD,
  });

  state.previousPosts.push(post);
  state.lastRun = new Date().toISOString();
  if (state.previousPosts.length > 50) state.previousPosts = state.previousPosts.slice(-50);
  saveState(state);

  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

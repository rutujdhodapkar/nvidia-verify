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
  const def = { previousPosts: [], postHashes: [], lastRun: null };
  if (!existsSync(STATE_FILE)) return def;
  try { return { ...def, ...JSON.parse(readFileSync(STATE_FILE, 'utf-8')) }; } catch { return def; }
}

function saveState(s) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function hash(t) { let h = 0; for (let i = 0; i < t.length; i++) { h = ((h << 5) - h) + t.charCodeAt(i); h |= 0; } return h.toString(16); }

function isDup(post, state) {
  const h = hash(post.slice(0, 100));
  if (state.postHashes.includes(h)) return true;
  for (const prev of state.previousPosts) {
    const words = [...new Set(post.toLowerCase().match(/\b\w{4,}\b/g) || [])];
    const prevWords = [...new Set(prev.toLowerCase().match(/\b\w{4,}\b/g) || [])];
    const common = words.filter(w => prevWords.includes(w)).length;
    if (common / Math.max(1, Math.min(words.length, prevWords.length)) > 0.5) return true;
  }
  return false;
}

async function main() {
  console.log(`\n═══ DEV/CRAFT LinkedIn Agent ═══\n${new Date().toISOString()}\n`);
  const state = loadState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b', LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN, LINKEDIN_PAGE_ID } = process.env;
  if (!NVIDIA_API_KEY || !LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REFRESH_TOKEN) { console.error('[!] Missing secrets'); process.exit(1); }

  console.log('[1/4] Scraping...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  let post, html, imageMeta, theme;
  for (let i = 0; i < 5; i++) {
    console.log(`[2/4] Generating (attempt ${i + 1})...`);
    const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL);
    post = r.post; html = r.html; imageMeta = r.imageMeta; theme = r.theme;
    if (!isDup(post, state)) break;
    console.log('      Duplicate, retry...\n');
  }
  if (isDup(post, state)) { console.error('[!] No unique post after 5 attempts'); process.exit(1); }
  console.log(`      "${post.slice(0, 90)}..."\n`);

  console.log('[3/4] Generating image...');
  let imageBuffer = null;
  try { imageBuffer = await generateImage({ html, post, imageMeta, theme, apiKey: NVIDIA_API_KEY }); } catch (err) { console.log(`      Skip: ${err.message}`); }

  console.log('\n[4/4] Posting to LinkedIn...');
  await postToLinkedin({ content: post, imageBuffer, refreshToken: LINKEDIN_REFRESH_TOKEN, clientId: LINKEDIN_CLIENT_ID, clientSecret: LINKEDIN_CLIENT_SECRET, pageId: LINKEDIN_PAGE_ID || null });

  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

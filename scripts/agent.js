import 'dotenv/config';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeSite } from './scraper.js';
import { generatePost } from './generator.js';
import { postToLinkedin } from './poster.js';
import { generateImageCard, generateImageNvidia } from './image-gen.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '..', 'data', 'state.json');

function loadState() {
  if (!existsSync(STATE_FILE)) return { previousPosts: [], lastRun: null, siteHistory: [] };
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  DEV/CRAFT LinkedIn Agent`);
  console.log(`  ${new Date().toISOString()}`);
  console.log(`═══════════════════════════════════════\n`);

  const state = loadState();
  const cfg = {
    nvidiaKey: process.env.NVIDIA_API_KEY,
    linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
    linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    linkedinRefresh: process.env.LINKEDIN_REFRESH_TOKEN,
    model: process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b',
  };

  if (!cfg.nvidiaKey) { console.error('[AGENT] Missing NVIDIA_API_KEY'); process.exit(1); }
  if (!cfg.linkedinClientId || !cfg.linkedinClientSecret || !cfg.linkedinRefresh) {
    console.error('[AGENT] Missing LinkedIn OAuth credentials'); process.exit(1);
  }

  console.log('[AGENT] Step 1/4: Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`[AGENT]   → ${Object.keys(siteData.pages).length} pages scraped`);

  console.log('\n[AGENT] Step 2/4: Generating post + image metadata...');
  const { post, imageData } = await generatePost(siteData, state.previousPosts, cfg.nvidiaKey, cfg.model);
  console.log(`[AGENT]   → "${post.slice(0, 80)}..."`);

  console.log('\n[AGENT] Step 3/4: Generating image...');
  let imageBuffer = await generateImageCard({
    headline: imageData.headline,
    subtext: imageData.subtext,
    stats: imageData.stats,
  });
  console.log(`[AGENT]   → HTML card: ${imageBuffer.length} bytes`);

  const nvidiaImage = await generateImageNvidia(post, cfg.nvidiaKey);
  if (nvidiaImage) {
    imageBuffer = nvidiaImage;
    console.log(`[AGENT]   → Using NVIDIA generated image: ${nvidiaImage.length} bytes`);
  } else {
    console.log('[AGENT]   → Using HTML card (NVIDIA image gen skipped or failed)');
  }

  console.log('\n[AGENT] Step 4/4: Posting to LinkedIn...');
  await postToLinkedin(post, imageBuffer, {
    clientId: cfg.linkedinClientId,
    clientSecret: cfg.linkedinClientSecret,
    refreshToken: cfg.linkedinRefresh,
  });

  state.previousPosts.push(post);
  state.lastRun = new Date().toISOString();
  state.siteHistory.push({ timestamp: state.lastRun, summary: siteData.summary });
  if (state.previousPosts.length > 50) state.previousPosts = state.previousPosts.slice(-50);
  saveState(state);

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  ✓ Agent run complete`);
  console.log(`═══════════════════════════════════════\n`);
}

main().catch(err => {
  console.error('[AGENT] Fatal error:', err);
  process.exit(1);
});

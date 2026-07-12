import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { scrapeSite } from './scraper.js';
import { generatePost, reviewPost } from './generator.js';
import { generateImage } from './image-gen.js';
import { postToLinkedinPage } from './zapier-poster.js';
import { getFigmaImageUrl, getFigmaFileData } from './figma.js';
import { loadState, saveState, hash, isDup } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'images');

function getImageUrl(filename) {
  const repo = 'rutujdhodapkar/nvidia-verify';
  const branch = 'master';
  return `https://raw.githubusercontent.com/${repo}/${branch}/images/${filename}`;
}

async function main() {
  console.log(`\n═══ DEV/CRAFT LinkedIn Agent ═══\n${new Date().toISOString()}\n`);
  const state = await loadState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL, ZAPIER_TOKEN, HF_API_TOKEN, LINKEDIN_PAGE_ID = '134233993', FIGMA_TOKEN, FIGMA_FILE_KEY, FIGMA_FRAME_ID } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }
  if (!ZAPIER_TOKEN) { console.error('[!] Missing ZAPIER_TOKEN'); process.exit(1); }

  console.log('[1/4] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  // Step 1: Generate post
  let post, html, imageMeta, theme, designBrief;
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/4] Generating post (attempt ${i + 1})...`);
    const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
    post = r.post; html = r.html; imageMeta = r.imageMeta; theme = r.theme; designBrief = r.designBrief;
    if (isDup(post, state)) { console.log('      Duplicate, retry...\n'); continue; }

    console.log('      Reviewing content quality...');
    const review = await reviewPost(post, NVIDIA_API_KEY, NVIDIA_MODEL);
    console.log(`      Quality score: ${review.score}/10 — ${review.feedback}`);
    if (review.score >= 7) { postOk = true; break; }
    feedback = review.feedback;
    console.log('      Below threshold, retry...\n');
  }
  if (!postOk) { console.error('[!] No quality post after 5 attempts'); process.exit(1); }
  console.log(`      "${post.slice(0, 120)}..."\n`);

  // Step 2: Generate image — code-based primary, Figma optional override
  console.log('[3/4] Generating image...');
  let imageUrl = null;

  // Try Figma if configured (optional export from pre-made designs)
  if (FIGMA_TOKEN && FIGMA_FILE_KEY && FIGMA_FRAME_ID) {
    console.log('      Trying Figma export (optional)...');
    imageUrl = await getFigmaImageUrl(FIGMA_TOKEN, FIGMA_FILE_KEY, FIGMA_FRAME_ID);
    if (imageUrl) console.log(`      ✓ Figma: ${imageUrl}`);
  }

  // Primary: code-based generation (AI background + modern template cards)
  if (!imageUrl) {
    console.log('      Generating code-based design...');
    let imageBuffer = null;
    for (let i = 0; i < 3; i++) {
      console.log(`      Attempt ${i + 1}...`);
      try {
        imageBuffer = await generateImage({ html: null, post, imageMeta, designBrief, apiKey: NVIDIA_API_KEY, hfToken: HF_API_TOKEN });
        if (imageBuffer && imageBuffer.length > 500) { console.log(`      ✓ Generated (${imageBuffer.length} bytes)`); break; }
      } catch (err) { console.log(`      Failed: ${err.message}`); }
      if (i < 2) console.log('      Retrying...');
    }

    if (!imageBuffer || imageBuffer.length < 500) {
      console.error('[!] Image generation failed after 3 attempts. Aborting.');
      process.exit(1);
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `post-${date}.png`;
    mkdirSync(IMAGES_DIR, { recursive: true });
    writeFileSync(join(IMAGES_DIR, filename), imageBuffer);

    try {
      execSync('git add images/', { stdio: 'pipe' });
      execSync('git -c user.name="devcraft-agent" -c user.email="agent@devcraft.fennark.xyz" commit -m "chore: add post image [skip ci]"', { stdio: 'pipe' });
      execSync('git pull --rebase origin master', { stdio: 'pipe', timeout: 15000 });
      execSync('git push', { stdio: 'pipe', timeout: 30000 });
    } catch (e) { console.log(`      Git push note: ${e.message}`); }
    imageUrl = getImageUrl(filename);
  }

  // Step 3: Validate
  console.log('\n[VALIDATION]...');
  if (!post || post.length < 10) { console.error('[!] Invalid content. Aborting.'); process.exit(1); }
  if (!imageUrl) { console.error('[!] No image URL. Aborting.'); process.exit(1); }
  console.log(`      ✓ Content (${post.length} chars)`);
  console.log(`      ✓ Image: ${imageUrl}\n`);

  // Step 4: Post to LinkedIn company page only
  console.log('[4/4] Posting to LinkedIn company page...');
  await postToLinkedinPage({ content: post, imageUrl, zapierToken: ZAPIER_TOKEN, pageId: LINKEDIN_PAGE_ID });

  // Track state
  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

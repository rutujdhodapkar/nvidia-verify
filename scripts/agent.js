import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeSite } from './scraper.js';
import { generatePost, reviewPost } from './generator.js';
import { generateImage } from './image-gen.js';
import { postToLinkedinPage } from './zapier-poster.js';
import { getFigmaImageUrl } from './figma.js';
import { loadState, saveState, hash, isDup } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'images');

async function uploadToGithub(filename, buffer) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('No GITHUB_TOKEN available');

  const repo = 'rutujdhodapkar/nvidia-verify';
  const path = `images/${filename}`;
  const b64 = buffer.toString('base64');

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'devcraft-agent',
    },
    body: JSON.stringify({
      message: `chore: add post image ${filename} [skip ci]`,
      content: b64,
      branch: 'master',
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const url = data?.content?.download_url;
  if (!url) throw new Error('No download_url in GitHub API response');
  return url;
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

  // Step 2: Generate image
  console.log('[3/4] Generating image...');
  let imageUrl = null;

  // Try Figma if configured (optional)
  if (FIGMA_TOKEN && FIGMA_FILE_KEY && FIGMA_FRAME_ID) {
    console.log('      Trying Figma export (optional)...');
    imageUrl = await getFigmaImageUrl(FIGMA_TOKEN, FIGMA_FILE_KEY, FIGMA_FRAME_ID);
    if (imageUrl) console.log(`      ✓ Figma: ${imageUrl}`);
  }

  // Primary: code-based generation + GitHub API upload
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

    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 2).padStart(2, '0');
    const filename = `post-${date}-${time}.png`;

    // Save locally too
    mkdirSync(IMAGES_DIR, { recursive: true });
    writeFileSync(join(IMAGES_DIR, filename), imageBuffer);

    // Upload via GitHub API (no git commands, no merge conflicts, instant URL)
    console.log('      Uploading to GitHub via API...');
    for (let i = 0; i < 3; i++) {
      try {
        imageUrl = await uploadToGithub(filename, imageBuffer);
        console.log(`      ✓ Uploaded: ${imageUrl}`);
        break;
      } catch (err) {
        console.log(`      Upload attempt ${i + 1} failed: ${err.message}`);
        if (i < 2) await new Promise(r => setTimeout(r, 3000));
      }
    }

    if (!imageUrl) {
      console.error('[!] Failed to upload image after 3 attempts. Aborting.');
      process.exit(1);
    }
  }

  // Step 3: Validate
  console.log('\n[VALIDATION]...');
  if (!post || post.length < 10) { console.error('[!] Invalid content. Aborting.'); process.exit(1); }
  if (!imageUrl) { console.error('[!] No image URL. Aborting.'); process.exit(1); }
  console.log(`      ✓ Content (${post.length} chars)`);
  console.log(`      ✓ Image: ${imageUrl}\n`);

  // Step 4: Post to LinkedIn company page
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

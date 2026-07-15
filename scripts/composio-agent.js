import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeSite } from './scraper.js';
import { generatePost, reviewPost } from './generator.js';
import { generateImage } from './image-gen.js';
import { postToLinkedinPage } from './linkedin-poster.js';
import { postToLinkedinPage as postToLinkedinViaZapier } from './zapier-poster.js';
import { loadState, saveState, hash, isDup } from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'images');

function cleanPost(text) {
  let t = text.trim();
  // Strip leading reasoning/preface lines the AI sometimes adds
  const prefacePatterns = [
    /^here('s| is)\s+(the\s+)?(improved\s+)?(linkedin\s+)?post:?\s*/i,
    /^here('s| is)\s+(your\s+)?(improved\s+)?post:?\s*/i,
    /^i('ve| have)\s+(improved|rewritten|updated)\s+(the\s+)?(post|content):?\s*/i,
    /^(okay|ok|sure|here|below|following)(,|!)?\s*(here's|is)\s*/i,
    /^```(json|markdown)?\s*/i,
  ];
  for (const p of prefacePatterns) {
    t = t.replace(p, '');
  }
  t = t.replace(/```/g, '').trim();
  // Strip hashtags from body (sent separately via API)
  t = t.replace(/\n?#\w+/g, '').trim();
  // Strip raw URL from post text (image already has it)
  t = t.replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz').trim();
  return t;
}

async function uploadToGithub(filename, buffer) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('No GITHUB_TOKEN available');
  const repo = 'rutujdhodapkar/nvidia-verify';
  const path = `images/${filename}`;
  const b64 = buffer.toString('base64');
  let sha = null;
  const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'devcraft-agent' },
  });
  if (getRes.ok) { const existing = await getRes.json(); sha = existing.sha; }
  const body = { message: `chore: add post image ${filename} [skip ci]`, content: b64, branch: 'master' };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'devcraft-agent' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err = await res.text().catch(() => ''); throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`); }
  const data = await res.json();
  return data?.content?.download_url;
}

function extractHashtags(text) {
  const tags = text.match(/#\w+/g);
  return tags ? [...new Set(tags)].join(' ') : '#DevCraft #VirtualInternship';
}

async function main() {
  console.log(`\n═══ DEV/CRAFT Agent ═══\n${new Date().toISOString()}\n`);

  const state = await loadState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL, HF_API_TOKEN } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }

  console.log('[1/4] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  let post, imageMeta, designBrief;
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/4] Generating post (attempt ${i + 1})...`);
    const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
    post = r.post; imageMeta = r.imageMeta; designBrief = r.designBrief;
    if (isDup(post, state)) { console.log('      Duplicate, retry...\n'); continue; }
    const cleaned = cleanPost(post);
    const review = await reviewPost(cleaned, NVIDIA_API_KEY, NVIDIA_MODEL);
    console.log(`      Quality score: ${review.score}/10 — ${review.feedback}`);
    if (review.score >= 7) { post = cleaned; postOk = true; break; }
    feedback = review.feedback;
    console.log('      Below threshold, retry...\n');
  }
  if (!postOk) { console.error('[!] No quality post after 5 attempts'); process.exit(1); }
  console.log(`\n${post}\n`);

  const hashtags = extractHashtags(post);

  console.log('[3/4] Generating image...');
  let imageUrl = null;
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
    console.log('[!] Image generation failed, proceeding without image');
  } else {
    const now = new Date();
    const datestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = now.toTimeString().slice(0, 5).replace(/:/g, '');
    const filename = `post-${datestamp}-${timestamp}.png`;

    mkdirSync(IMAGES_DIR, { recursive: true });
    writeFileSync(join(IMAGES_DIR, filename), imageBuffer);
    console.log('      ✓ Saved locally');

    for (let i = 0; i < 2; i++) {
      try {
        imageUrl = await uploadToGithub(filename, imageBuffer);
        console.log(`      ✓ Uploaded: ${imageUrl}`);
        break;
      } catch (err) {
        console.log(`      Upload attempt ${i + 1} failed: ${err.message}`);
        if (i < 2) await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!imageUrl) console.log('[!] Upload skipped — no GITHUB_TOKEN');
  }

  console.log('\n[VALIDATION]...');
  if (!post || post.length < 10) { console.error('[!] Invalid content.'); process.exit(1); }
  console.log(`      ✓ Content (${post.length} chars)`);
  if (imageUrl) console.log(`      ✓ Image available\n`);

  // Try LinkedIn REST API first (proper image embedding), fall back to Zapier
  let posted = false;

  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_REFRESH_TOKEN) {
    console.log('[4/4] Posting via LinkedIn REST API (direct, image embedded)...');
    try {
      const result = await postToLinkedinPage({
        content: post,
        imageUrl: imageUrl || null,
        pageId: process.env.LINKEDIN_PAGE_ID,
      });
      console.log(`      ✓ Posted via LinkedIn API: ${result}`);
      posted = true;
    } catch (err) {
      console.log(`      ⚠ LinkedIn API failed: ${err.message.slice(0, 150)}`);
      console.log('      Falling back to Zapier...');
    }
  }

  if (!posted) {
    console.log('[4/4] Posting to LinkedIn via Zapier MCP (image as link thumbnail)...');
    try {
      const result = await postToLinkedinViaZapier({
        content: post,
        imageUrl: imageUrl || '',
        zapierToken: process.env.ZAPIER_TOKEN,
        pageId: process.env.LINKEDIN_PAGE_ID,
      });
      console.log(`      ✓ Posted via Zapier MCP: ${result}`);
      posted = true;
    } catch (err) {
      console.log(`      ⚠ Zapier MCP failed: ${err.message.slice(0, 150)}`);
    }
  }

  if (!posted) {
    console.log('[!] All posting methods failed');
    process.exit(1);
  }

  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

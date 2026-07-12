import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { scrapeSite } from './scraper.js';
import { generatePost } from './generator.js';
import { generateImage } from './image-gen.js';
import { postToLinkedinPage } from './zapier-poster.js';
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
  const { NVIDIA_API_KEY, NVIDIA_MODEL, ZAPIER_TOKEN, HF_API_TOKEN, LINKEDIN_PAGE_ID = '134233993' } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }
  if (!ZAPIER_TOKEN) { console.error('[!] Missing ZAPIER_TOKEN'); process.exit(1); }

  console.log('[1/4] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  let post, html, imageMeta, theme;
  for (let i = 0; i < 5; i++) {
    console.log(`[2/4] Generating post (attempt ${i + 1})...`);
    const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL);
    post = r.post; html = r.html; imageMeta = r.imageMeta; theme = r.theme;
    if (!isDup(post, state)) break;
    console.log('      Duplicate, retry...\n');
  }
  if (isDup(post, state)) { console.error('[!] No unique post after 5 attempts'); process.exit(1); }
  console.log(`      "${post.slice(0, 100)}..."\n`);

  console.log('[3/4] Generating image card...');
  let imageUrl = null;
  try {
    const imageBuffer = await generateImage({ html, post, imageMeta, theme, apiKey: NVIDIA_API_KEY, hfToken: HF_API_TOKEN });
    if (imageBuffer) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `post-${date}.png`;
      mkdirSync(IMAGES_DIR, { recursive: true });
      writeFileSync(join(IMAGES_DIR, filename), imageBuffer);
      console.log(`      Saved to images/${filename} (${imageBuffer.length} bytes)`);

      try {
        execSync('git add images/', { stdio: 'pipe' });
        execSync('git -c user.name="devcraft-agent" -c user.email="agent@devcraft.fennark.xyz" commit -m "chore: add post image [skip ci]"', { stdio: 'pipe' });
        execSync('git pull --rebase origin master', { stdio: 'pipe', timeout: 15000 });
        execSync('git push', { stdio: 'pipe', timeout: 30000 });
      } catch (e) {
        console.log(`      Git commit/push note: ${e.message}`);
      }
      imageUrl = getImageUrl(filename);
      console.log(`      Image URL: ${imageUrl}`);
    }
  } catch (err) {
    console.log(`      Image generation skipped: ${err.message}`);
  }

  console.log('\n[4/4] Posting to LinkedIn Page via Zapier...');
  await postToLinkedinPage({ content: post, imageUrl, zapierToken: ZAPIER_TOKEN, pageId: LINKEDIN_PAGE_ID });

  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

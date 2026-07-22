import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { generatePost, reviewPost } from './generator.js';
import { postToLinkedinPage } from './linkedin-poster.js';
import { postToLinkedinPage as postToLinkedinViaZapier } from './zapier-poster.js';
import { loadState, saveState, hash, isDup } from './state.js';

async function main() {
  console.log(`\n═══ DEV/CRAFT LinkedIn Agent ═══\n${new Date().toISOString()}\n`);
  const state = await loadState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL, ZAPIER_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_REFRESH_TOKEN, LINKEDIN_PAGE_ID = '134233993' } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }
  if (!ZAPIER_TOKEN) { console.error('[!] Missing ZAPIER_TOKEN'); process.exit(1); }

  console.log('[1/3] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  // Step 1: Generate post
  let post;
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/3] Generating post (attempt ${i + 1})...`);
    try {
      const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
      post = r.post;
    } catch (err) {
      feedback = err.message;
      console.log(`      ${err.message}`);
      if (i < 4) console.log('      Retrying...\n');
      continue;
    }
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

  // Step 3: Validate
  console.log('\n[VALIDATION]...');
  if (!post || post.length < 10) { console.error('[!] Invalid content. Aborting.'); process.exit(1); }
  console.log(`      ✓ Content (${post.length} chars)\n`);

  // Step 4: Post to LinkedIn company page
  let posted = false;
  const cleanPost = post.replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz');

  if (LINKEDIN_CLIENT_ID && LINKEDIN_REFRESH_TOKEN) {
    console.log('[3/3] Posting via LinkedIn REST API...');
    try {
      const result = await postToLinkedinPage({ content: cleanPost, pageId: LINKEDIN_PAGE_ID });
      console.log(`      ✓ Posted via LinkedIn API: ${result}`);
      posted = true;
    } catch (err) {
      console.log(`      ⚠ LinkedIn API failed: ${err.message.slice(0, 150)}`);
      console.log('      Falling back to Zapier...');
    }
  }

  if (!posted) {
    console.log('[3/3] Posting to LinkedIn via Zapier MCP...');
    try {
      const result = await postToLinkedinViaZapier({
        content: cleanPost,
        zapierToken: ZAPIER_TOKEN,
        pageId: LINKEDIN_PAGE_ID,
      });
      console.log(`      ✓ Posted via Zapier MCP: ${result}`);
      posted = true;
    } catch (err) {
      console.log(`      ⚠ Zapier MCP failed: ${err.message.slice(0, 150)}`);
    }
  }

  if (!posted) {
    console.error('[!] All posting methods failed');
    process.exit(1);
  }

  // Track state
  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  state.lastRun = new Date().toISOString();
  await saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

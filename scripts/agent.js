import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { generatePost, reviewPost } from './generator.js';
import { postToLinkedinPageWithComment } from './linkedin-poster.js';
import { postToLinkedinPage as postToLinkedinViaZapier } from './zapier-poster.js';
import { loadState, saveState, hash, isDup } from './state.js';
import { maybeWaitForPeakIST } from './timing.js';

async function main() {
  console.log(`\n═══ DEV/CRAFT LinkedIn Agent (Max-Impressions) ═══\n${new Date().toISOString()}\n`);
  await maybeWaitForPeakIST();

  const state = await loadState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL, ZAPIER_TOKEN, LINKEDIN_CLIENT_ID, LINKEDIN_REFRESH_TOKEN, LINKEDIN_PAGE_ID = '134233993' } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }

  console.log('[1/4] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  // Step 1: Generate post
  let post;
  let firstComment = '';
  let postOk = false;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/4] Generating post (attempt ${i + 1})...`);
    try {
      const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
      post = r.post;
      firstComment = r.firstComment;
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

  // Step 2: Validate
  console.log('\n[VALIDATION]...');
  if (!post || post.length < 10) { console.error('[!] Invalid content. Aborting.'); process.exit(1); }
  console.log(`      ✓ Content (${post.length} chars)\n`);

  // Step 3: Post to LinkedIn company page (link goes in the first comment)
  let posted = false;
  let postId = null;
  const cleanPost = post.replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz');
  const cleanFirstComment = (firstComment || '').replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz');

  if (LINKEDIN_CLIENT_ID && LINKEDIN_REFRESH_TOKEN) {
    console.log('[3/4] Posting via LinkedIn REST API...');
    try {
      const result = await postToLinkedinPageWithComment({
        content: cleanPost,
        firstComment: cleanFirstComment,
        pageId: LINKEDIN_PAGE_ID,
      });
      console.log(`      ✓ Posted via LinkedIn API: ${result.postId} (first comment: ${result.commentAdded ? 'yes' : 'no'})`);
      postId = typeof result.postId === 'string' ? result.postId : null;
      posted = true;
    } catch (err) {
      console.log(`      ⚠ LinkedIn API failed: ${err.message.slice(0, 150)}`);
      console.log('      Falling back to Zapier...');
    }
  }

  if (!posted) {
    console.log('[3/4] Posting to LinkedIn via Zapier MCP...');
    try {
      const result = await postToLinkedinViaZapier({
        content: cleanPost,
        zapierToken: ZAPIER_TOKEN,
        pageId: LINKEDIN_PAGE_ID,
      });
      console.log(`      ✓ Posted via Zapier MCP: ${result}`);
      postId = typeof result === 'string' && result.includes('urn:li:') ? result : null;
      posted = true;
    } catch (err) {
      console.log(`      ⚠ Zapier MCP failed: ${err.message.slice(0, 150)}`);
    }
  }

  if (!posted) {
    console.error('[!] All posting methods failed');
    process.exit(1);
  }

  // Step 4: Track state (last post URN feeds the comment-reply loop in engage.js)
  state.previousPosts.push(post);
  state.postHashes.push(hash(post.slice(0, 100)));
  if (state.previousPosts.length > 50) { state.previousPosts.shift(); state.postHashes.shift(); }
  if (postId && /urn:li:/.test(postId)) state.lastPostUrn = postId;
  state.repliedComments = state.repliedComments || {};
  state.lastRun = new Date().toISOString();
  await saveState(state);
  console.log(`\n═══ ✓ Done ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

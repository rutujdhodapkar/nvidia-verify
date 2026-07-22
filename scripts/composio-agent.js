import 'dotenv/config';
import { scrapeSite } from './scraper.js';
import { generatePost, reviewPost } from './generator.js';
import { postToLinkedinPage } from './linkedin-poster.js';
import { postToLinkedinPage as postToLinkedinViaZapier } from './zapier-poster.js';
import { loadState, saveState, hash, isDup } from './state.js';

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
  // Strip raw URL from post text
  t = t.replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz').trim();
  return t;
}

function extractHashtags(text) {
  const tags = text.match(/#\w+/g);
  return tags ? [...new Set(tags)].join(' ') : '#DevCraft #VirtualInternship';
}

async function main() {
  console.log(`\n═══ DEV/CRAFT Agent ═══\n${new Date().toISOString()}\n`);

  const state = await loadState();
  const { NVIDIA_API_KEY, NVIDIA_MODEL } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }

  console.log('[1/3] Scraping devcraft.fennark.xyz...');
  const siteData = await scrapeSite();
  console.log(`      ${Object.keys(siteData.pages).length} pages\n`);

  let post;
  let postOk = false;
  let bestPost = null, bestScore = 0;
  let feedback = '';
  for (let i = 0; i < 5; i++) {
    console.log(`[2/3] Generating post (attempt ${i + 1})...`);
    try {
      const r = await generatePost(siteData, state.previousPosts, NVIDIA_API_KEY, NVIDIA_MODEL, feedback);
      post = r.post;
    } catch (err) {
      feedback = 'violation: ' + err.message.slice(0, 100);
      console.log(`      ${err.message}`);
      if (i < 4) console.log('      Retrying...\n');
      continue;
    }
    if (isDup(post, state)) { console.log('      Duplicate, retry...\n'); continue; }
    const hashtagsBeforeClean = extractHashtags(post || '');
    const cleaned = cleanPost(post);
    const review = await reviewPost(cleaned + '\n\n' + hashtagsBeforeClean, NVIDIA_API_KEY, NVIDIA_MODEL);
    console.log(`      Quality score: ${review.score}/10 — ${review.feedback}`);
    if (review.score >= 7) { post = cleaned + '\n\n' + hashtagsBeforeClean; postOk = true; break; }
    if (review.score > bestScore) {
      bestScore = review.score;
      bestPost = cleaned + '\n\n' + hashtagsBeforeClean;
    }
    feedback = review.feedback || 'write a stronger hook and clearer value';
    console.log('      Below threshold, retry...\n');
  }
  if (!postOk) {
    if (bestPost) {
      console.log(`\nUsing best attempt (score ${bestScore}/10)\n`);
      post = bestPost;
      postOk = true;
    } else {
      console.error('[!] No quality post after 5 attempts');
      process.exit(1);
    }
  }
  console.log(`\n${post}\n`);

  console.log('\n[VALIDATION]...');
  if (!post || post.length < 10) { console.error('[!] Invalid content.'); process.exit(1); }
  console.log(`      ✓ Content (${post.length} chars)\n`);

  // Try LinkedIn REST API first, fall back to Zapier
  let posted = false;

  if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_REFRESH_TOKEN) {
    console.log('[3/3] Posting via LinkedIn REST API...');
    try {
      const result = await postToLinkedinPage({
        content: post,
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
    console.log('[3/3] Posting to LinkedIn via Zapier MCP...');
    try {
      const result = await postToLinkedinViaZapier({
        content: post,
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
    console.log('      To fix LinkedIn: Run "node scripts/get-token.js" locally, follow the OAuth flow,');
    console.log('      and update the LINKEDIN_REFRESH_TOKEN GitHub secret with the new token.');
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

import 'dotenv/config';
import { loadState, saveState } from './state.js';
import { callWithRetry } from './generator.js';

const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API_REST = 'https://api.linkedin.com/rest';

// ============================================================
// LinkedIn Comment Engagement Loop
// Replies to every new comment on recent posts. Comment depth is
// the #1 ranking signal in 2026 — top creators reply 741% more
// than average. Each reply ends with a follow-up question to keep
// the thread alive and stretch the post's distribution window.
// ============================================================

function buildReplyPrompt(postUrn, commentText) {
  return `You are DevCraft's community manager replying to comments on a LinkedIn post about DevCraft — a 100% virtual internship platform for students around the world (real projects, instant offer letter, verified certificate).

Write a SHORT reply to the student's comment. Rules:
- 1-3 sentences max. Sound human and specific — like a helpful senior, never like a bot or a salesperson.
- Acknowledge what THEY said (reference their field/domain/concern/country if mentioned).
- End with ONE short follow-up question that keeps the conversation going and pulls ANOTHER comment back (a specific easy question: their field, their next project, their current college year).
- If they ask for the link, give it plainly: devcraft.fennark.xyz
- NEVER promise jobs, placement, employment, interviews, or salary.
- NEVER mention fees, pricing, or "free".
- NEVER claim the certificate is recognized by employers or universities.
- No emoji spam, no "thanks for your comment".
- If the comment is a compliment or one-liner, still reply warmly and add one useful detail.
- When the commenter answers your question, compliment one SPECIFIC thing they said and ask ONE deeper question — thread depth is the #1 ranking signal, so useful back-and-forth = more reach.

Post: ${postUrn}

Comment: "${commentText}"

Return ONLY the reply text.`;
}

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' };
}

async function refreshAccessToken() {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN } = process.env;
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REFRESH_TOKEN) {
    throw new Error('Missing LinkedIn OAuth credentials');
  }
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: LINKEDIN_REFRESH_TOKEN,
      client_id: LINKEDIN_CLIENT_ID,
      client_secret: LINKEDIN_CLIENT_SECRET,
      scope: 'w_organization_social rw_organization_admin openid profile email',
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token refresh failed ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  if (tokenData.refresh_token && tokenData.refresh_token !== LINKEDIN_REFRESH_TOKEN) {
    process.env.LINKEDIN_REFRESH_TOKEN = tokenData.refresh_token;
    const { persistRefreshToken } = await import('./token-store.js');
    await persistRefreshToken(tokenData.refresh_token);
  }
  return tokenData.access_token;
}

async function getComments(accessToken, postUrn) {
  const res = await fetch(`${API_REST}/socialActions/${encodeURIComponent(postUrn)}/comments?count=100`, {
    headers: { ...authHeaders(accessToken), 'LinkedIn-Version': '202603' },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`GET comments failed ${res.status}: ${err.slice(0, 200)}`);
  }
  return (await res.json()).elements || [];
}

async function postReply(accessToken, owner, postUrn, commentUrn, text) {
  const res = await fetch(`${API_REST}/socialActions/${encodeURIComponent(commentUrn)}/comments`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'LinkedIn-Version': '202603' },
    body: JSON.stringify({ actor: owner, object: postUrn, parentComment: commentUrn, message: { text } }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Reply failed ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.headers.get('x-restli-id') || 'ok';
}

function isSpam(text = '') {
  const t = text.toLowerCase();
  if (t.length < 3) return true;
  if (/https?:\/\/\S+|www\.\S+/.test(t)) return true;
  if (/(follow me|subscribe|dm me on|@\S+\s+onlyfans|earn \$\d+|get rich|join my telegram)/i.test(t)) return true;
  return false;
}

function isOwnComment(actor, owner) {
  if (!actor || !owner) return false;
  return actor === owner;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const maxReplies = Number(process.argv.find(a => a.startsWith('--count='))?.split('=')[1] || 10);

  console.log(`\n═══ DEV/CRAFT LinkedIn Comment-Reply Loop ═══\n${new Date().toISOString()}\n`);
  const state = await loadState();

  const { NVIDIA_API_KEY, NVIDIA_MODEL, LINKEDIN_PAGE_ID = '134233993' } = process.env;
  if (!NVIDIA_API_KEY) { console.error('[!] Missing NVIDIA_API_KEY'); process.exit(1); }

  const postUrn = process.argv.find(a => a.startsWith('--post='))?.split('=')[1] || state.lastPostUrn;
  if (!postUrn) {
    console.error('[!] No post to engage. Run agent.js once first, or pass --post=urn:li:...');
    process.exit(1);
  }
  console.log(`Engaging on: ${postUrn}`);

  const accessToken = await refreshAccessToken();
  const owner = `urn:li:organization:${LINKEDIN_PAGE_ID}`;

  const comments = await getComments(accessToken, postUrn);
  const pending = comments.filter(c => {
    const id = c.id || c.commentUrn;
    return id && !isOwnComment(c.actor, owner) && !state.repliedComments?.[id] && !isSpam(c.message?.text);
  });
  console.log(`      ${comments.length} comments, ${pending.length} new to reply\n`);

  if (dryRun) {
    for (const c of pending.slice(0, maxReplies)) {
      console.log(`[DRY-RUN] Would reply to ${c.id}: "${(c.message?.text || '').slice(0, 80)}..."`);
    }
    process.exit(0);
  }

  let replied = 0;
  state.repliedComments = state.repliedComments || {};
  for (const c of pending.slice(0, maxReplies)) {
    const id = c.id || c.commentUrn;
    const commentText = c.message?.text || '';
    try {
      const reply = await callWithRetry(
        buildReplyPrompt(postUrn, commentText.slice(0, 400)),
        NVIDIA_API_KEY,
        NVIDIA_MODEL,
        300
      );
      const cleanReply = reply.replace(/["""`]/g, '').trim().slice(0, 500);
      if (!cleanReply || cleanReply.length < 5) throw new Error('Empty reply');

      const replyId = await postReply(accessToken, owner, postUrn, id, cleanReply);
      state.repliedComments[id] = true;
      replied++;
      console.log(`      ✓ Replied (${replied}/${pending.length}): "${cleanReply.slice(0, 90)}..." [${replyId}]`);
      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.log(`      ⚠ Reply failed for ${id}: ${err.message.slice(0, 150)}`);
    }
  }

  state.lastRun = new Date().toISOString();
  await saveState(state);
  console.log(`\n═══ ✓ Replied to ${replied} comment${replied === 1 ? '' : 's'} ═══`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

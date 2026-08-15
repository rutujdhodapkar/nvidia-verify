const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API_REST = 'https://api.linkedin.com/rest';
const API_V2 = 'https://api.linkedin.com/v2';

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' };
}

async function discoverOrgUrn(accessToken, pageId) {
  const headers = authHeaders(accessToken);
  const vanityRes = await fetch(`${API_V2}/organizations?q=vanityName&vanityName=devcraft-internships`, { headers });
  if (vanityRes.ok) {
    const data = await vanityRes.json();
    if (data?.elements?.[0]?.id) return `urn:li:organization:${data.elements[0].id}`;
  }
  const aclRes = await fetch(`${API_V2}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR`, { headers });
  if (aclRes.ok) {
    const data = await aclRes.json();
    const entity = data?.elements?.[0]?.organizationalTarget;
    if (entity) return entity;
  }
  return `urn:li:organization:${pageId || '134233993'}`;
}

async function refreshAccessToken() {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN } = process.env;
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REFRESH_TOKEN) {
    throw new Error('Missing LinkedIn OAuth credentials');
  }
  console.log('      Refreshing LinkedIn token...');
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
  if (!tokenRes.ok) {
    const err = await tokenRes.text().catch(() => '');
    if (tokenRes.status === 400 && err.includes('invalid_grant')) {
      throw new Error(`LinkedIn refresh token expired. Run: node scripts/get-token.js`);
    }
    throw new Error(`Token refresh failed ${tokenRes.status}: ${err.slice(0, 200)}`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('No access_token in response');
  if (tokenData.refresh_token && tokenData.refresh_token !== LINKEDIN_REFRESH_TOKEN) {
    process.env.LINKEDIN_REFRESH_TOKEN = tokenData.refresh_token;
    const { persistRefreshToken } = await import('./token-store.js');
    await persistRefreshToken(tokenData.refresh_token);
  }
  console.log('      ✓ Token refreshed');
  return accessToken;
}

async function postViaRestApi(accessToken, owner, commentary) {
  const postBody = {
    author: owner,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  const postRes = await fetch(`${API_REST}/posts`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'LinkedIn-Version': '202603' },
    body: JSON.stringify(postBody),
  });
  if (postRes.ok) {
    const postId = postRes.headers.get('x-restli-id') || postRes.headers.get('location') || 'success';
    console.log(`[POST] ✓ Company page post: ${postId}`);
    return postId;
  }
  const errText = await postRes.text().catch(() => '');
  console.log(`      /rest/posts failed (${postRes.status}): ${errText.slice(0, 300)}`);
  return null;
}async function postViaUgcApi(accessToken, owner, commentary) {
  const postBody = {
    author: owner,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: commentary },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const postRes = await fetch(`${API_V2}/ugcPosts`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(postBody),
  });
  if (postRes.ok) {
    const postUrl = postRes.headers.get('location') || 'success';
    console.log(`[POST] ✓ Company page (UGC): ${postUrl}`);
    return postUrl;
  }
  const errText = await postRes.text().catch(() => '');
  throw new Error(`UGC post failed ${postRes.status}: ${errText.slice(0, 300)}`);
}

export async function postToLinkedinPage({ content, pageId }) {
  return await postToLinkedinPageWithComment({ content, pageId });
}

// Posts the main content, then drops the signup link as the FIRST comment.
// Keeping links out of the post body preserves reach (attached link cards cost ~50%).
export async function postToLinkedinPageWithComment({ content, firstComment, pageId }) {
  let accessToken;
  try {
    accessToken = await refreshAccessToken();
  } catch (err) {
    console.log(`      ⚠ Token refresh failed: ${err.message.slice(0, 150)}`);
    throw err;
  }
  const owner = await discoverOrgUrn(accessToken, pageId);
  console.log(`      ✓ Owner: ${owner}`);

  const result = await postViaRestApi(accessToken, owner, content);
  let postId = result;
  let commentAdded = false;

  if (result && firstComment) {
    const postUrn = normalizePostUrn(result);
    if (postUrn) {
      try {
        await addFirstComment(accessToken, owner, postUrn, firstComment);
        console.log(`[COMMENT] ✓ First comment added (link lives in comments, not the post)`);
        commentAdded = true;
        postId = postUrn;
      } catch (err) {
        console.log(`      ⚠ First comment failed (non-fatal): ${err.message.slice(0, 200)}`);
      }
    }
  }

  if (result) return { postId, commentAdded };

  console.log('      Falling back to UGC API...');
  const ugcResult = await postViaUgcApi(accessToken, owner, content);
  return { postId: ugcResult, commentAdded: false };
}

function normalizePostUrn(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('urn:li:')) return trimmed;
  const m = trimmed.match(/posts\/(\d+)/);
  if (m) return `urn:li:share:${m[1]}`;
  if (/^\d+$/.test(trimmed)) return `urn:li:share:${trimmed}`;
  return trimmed || null;
}

// POST /rest/socialActions/{postUrn}/comments — needs w_organization_social (already in scope).
async function addFirstComment(accessToken, owner, postUrn, commentText) {
  const variants = [];
  if (postUrn.startsWith('urn:li:share:')) {
    const id = postUrn.split(':').pop();
    variants.push(postUrn, `urn:li:activity:${id}`);
  } else {
    variants.push(postUrn);
  }

  let lastErr;
  for (const variant of variants) {
    try {
      const res = await fetch(`${API_REST}/socialActions/${encodeURIComponent(variant)}/comments`, {
        method: 'POST',
        headers: { ...authHeaders(accessToken), 'LinkedIn-Version': '202603' },
        body: JSON.stringify({ actor: owner, object: variant, message: { text: commentText } }),
      });
      if (res.ok) {
        return res.headers.get('x-restli-id') || 'ok';
      }
      const errText = await res.text().catch(() => '');
      lastErr = new Error(`Comment failed ${res.status}: ${errText.slice(0, 200)}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Comment failed');
}

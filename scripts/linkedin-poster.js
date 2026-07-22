const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API_REST = 'https://api.linkedin.com/rest';
const API_V2 = 'https://api.linkedin.com/v2';

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
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
    headers: { ...authHeaders(accessToken), 'LinkedIn-Version': '202401' },
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
}

async function postViaUgcApi(accessToken, owner, commentary) {
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
  const accessToken = await refreshAccessToken();
  const owner = await discoverOrgUrn(accessToken, pageId);
  console.log(`      ✓ Owner: ${owner}`);

  const result = await postViaRestApi(accessToken, owner, content);
  if (result) return result;

  console.log('      Falling back to UGC API...');
  return await postViaUgcApi(accessToken, owner, content);
}

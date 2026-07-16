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
    throw new Error(`Token refresh failed ${tokenRes.status}: ${err.slice(0, 200)}`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) throw new Error('No access_token in response');
  console.log('      ✓ Token refreshed');
  return accessToken;
}

async function uploadImageRestApi(accessToken, owner, imageUrl) {
  const initRes = await fetch(`${API_REST}/images?action=initializeUpload`, {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'LinkedIn-Version': '202401' },
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    console.log(`      /rest/images init failed (${initRes.status}): ${errText.slice(0, 200)}`);
    return null;
  }
  const initData = await initRes.json();
  const uploadUrl = initData?.value?.uploadUrl;
  const imageUrn = initData?.value?.image;
  if (!uploadUrl || !imageUrn) {
    console.log('      No uploadUrl or image in /rest/images response');
    return null;
  }
  console.log('      Uploading image binary to /rest/images upload URL...');
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
  if (!imgRes.ok) {
    console.log(`      Fetching image from URL failed: ${imgRes.status}`);
    return null;
  }
  const imgBuf = await imgRes.arrayBuffer();
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    body: imgBuf,
    headers: { 'Content-Type': 'application/octet-stream' },
    signal: AbortSignal.timeout(30000),
  });
  if (uploadRes.ok) {
    console.log(`      ✓ Image uploaded via /rest/images: ${imageUrn}`);
    return imageUrn;
  }
  const ue = await uploadRes.text().catch(() => '');
  console.log(`      Image binary upload to /rest/images failed: ${ue.slice(0, 100)}`);
  return null;
}

async function uploadImageLegacyApi(accessToken, owner, imageUrl) {
  const registerRes = await fetch(`${API_V2}/assets?action=registerUpload`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });
  if (!registerRes.ok) {
    const err = await registerRes.text().catch(() => '');
    console.log(`      /v2/assets register failed (${registerRes.status}): ${err.slice(0, 200)}`);
    return null;
  }
  const regData = await registerRes.json();
  const uploadUrl = regData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
  const asset = regData?.value?.asset;
  if (!uploadUrl || !asset) {
    console.log('      No uploadUrl or asset in /v2/assets response');
    return null;
  }
  console.log('      Uploading image binary to /v2/assets upload URL...');
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
  if (!imgRes.ok) {
    console.log(`      Fetching image from URL failed: ${imgRes.status}`);
    return null;
  }
  const imgBuf = await imgRes.arrayBuffer();
  const uploadRes = await fetch(uploadUrl, { method: 'POST', body: imgBuf, signal: AbortSignal.timeout(30000) });
  if (uploadRes.ok) {
    console.log(`      ✓ Image uploaded via /v2/assets: ${asset}`);
    return asset;
  }
  const ue = await uploadRes.text().catch(() => '');
  console.log(`      Image binary upload to /v2/assets failed: ${ue.slice(0, 100)}`);
  return null;
}

async function postViaRestApi(accessToken, owner, commentary, mediaUrn) {
  if (mediaUrn && !mediaUrn.startsWith('urn:li:image:')) {
    console.log('      Media URN is legacy format, skipping /rest/posts');
    return null;
  }
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
  if (mediaUrn && mediaUrn.startsWith('urn:li:image:')) {
    postBody.content = {
      media: { id: mediaUrn, altText: 'DevCraft Virtual Internship Program' },
    };
  }
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

async function postViaUgcApi(accessToken, owner, commentary, mediaUrn) {
  const shareMediaCategory = mediaUrn && mediaUrn.startsWith('urn:li:digitalmediaAsset:') ? 'IMAGE' : 'NONE';
  const postBody = {
    author: owner,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: commentary },
        shareMediaCategory,
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  if (shareMediaCategory === 'IMAGE') {
    postBody.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      description: { text: 'DevCraft Virtual Internship Program' },
      media: mediaUrn,
      title: { text: 'DevCraft Internship' },
    }];
  }
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

export async function postToLinkedinPage({ content, imageUrl, pageId }) {
  const accessToken = await refreshAccessToken();
  const owner = await discoverOrgUrn(accessToken, pageId);
  console.log(`      ✓ Owner: ${owner}`);

  let mediaUrn = null;
  if (imageUrl) {
    console.log('      Registering image upload...');
    mediaUrn = await uploadImageRestApi(accessToken, owner, imageUrl);
    if (!mediaUrn) {
      mediaUrn = await uploadImageLegacyApi(accessToken, owner, imageUrl);
    }
  }

  const result = await postViaRestApi(accessToken, owner, content, mediaUrn);
  if (result) return result;

  console.log('      Falling back to UGC API...');
  return await postViaUgcApi(accessToken, owner, content, mediaUrn);
}

const LINKEDIN_API = 'https://api.linkedin.com';

export async function postToLinkedin({ content, imageBuffer, refreshToken, clientId, clientSecret }) {
  if (!refreshToken) throw new Error('Missing LINKEDIN_REFRESH_TOKEN. Run: node scripts/get-token.js');

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  console.log('[POST] ✓ Token refreshed');

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers });
  const profile = await profileRes.json();
  if (!profileRes.ok) throw new Error(`Profile: ${JSON.stringify(profile)}`);
  const personId = profile.sub;
  console.log(`[POST] Authenticated as: ${personId}`);

  let assetUrn = null;
  if (imageBuffer) {
    assetUrn = await uploadImage(headers, personId, imageBuffer);
  }

  const postBody = {
    author: `urn:li:person:${personId}`,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (assetUrn) postBody.content = { media: { id: assetUrn } };

  const postRes = await fetch('https://api.linkedin.com/v2/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify(postBody),
  });

  const result = await postRes.json();
  if (!postRes.ok) throw new Error(`Post failed: ${JSON.stringify(result)}`);
  console.log(`[POST] ✓ Posted: ${result.id}`);
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function uploadImage(headers, personId, imageBuffer) {
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${personId}`,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });
  const register = await registerRes.json();
  if (!registerRes.ok) throw new Error(`Upload reg: ${JSON.stringify(register)}`);

  const uploadUrl = register.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = register.value.asset;

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: headers.Authorization, 'Content-Type': 'image/png' },
    body: imageBuffer,
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
  console.log('[POST] ✓ Image uploaded');
  return asset;
}

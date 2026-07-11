export async function postToLinkedin({ content, imageBuffer, refreshToken, clientId, clientSecret }) {
  if (!refreshToken) throw new Error('Missing LINKEDIN_REFRESH_TOKEN');

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  console.log('[POST] ✓ Token refreshed');
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', { headers });
  const profile = await profileRes.json();
  if (!profileRes.ok) throw new Error(`Profile: ${JSON.stringify(profile)}`);
  const personUrn = `urn:li:person:${profile.sub}`;
  console.log(`[POST] Authenticated: ${profile.sub}`);

  let mediaUrn = null;
  if (imageBuffer) {
    mediaUrn = await uploadImage(headers, personUrn, imageBuffer);
  }

  let body;
  if (mediaUrn) {
    body = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: mediaUrn }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
  } else {
    body = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
  }

  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const result = await postRes.json();
  if (!postRes.ok) throw new Error(`Post failed: ${JSON.stringify(result)}`);
  console.log(`[POST] ✓ Posted: ${result.id}`);
}

async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function uploadImage(headers, personUrn, imageBuffer) {
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
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
  if (!uploadRes.ok) throw new Error(`Upload: ${uploadRes.status}`);
  console.log('[POST] ✓ Image uploaded');
  return asset;
}

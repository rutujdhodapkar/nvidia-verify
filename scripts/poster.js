const COMPANY_URL = 'https://www.linkedin.com/company/devcraft-internships/';

export async function postToLinkedin({ content, imageBuffer, refreshToken, clientId, clientSecret, pageId }) {
  if (!refreshToken) throw new Error('Missing LINKEDIN_REFRESH_TOKEN');

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  console.log('[POST] ✓ Token refreshed');
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const p = await (await fetch('https://api.linkedin.com/v2/userinfo', { headers })).json();
  const authorUrn = `urn:li:person:${p.sub}`;
  console.log(`[POST] Posting as user: ${p.sub}`);

  const finalContent = pageId ? `${content}\n\n${COMPANY_URL}` : content;

  let mediaUrn = null;
  if (imageBuffer) {
    const reg = await (await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST', headers,
      body: JSON.stringify({ registerUploadRequest: { recipes: ['urn:li:digitalmediaRecipe:feedshare-image'], owner: authorUrn, serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }] } }),
    })).json();
    const uploadUrl = reg.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    mediaUrn = reg.value.asset;
    await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: headers.Authorization, 'Content-Type': 'image/png' }, body: imageBuffer });
    console.log('[POST] ✓ Image uploaded');
  }

  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST', headers,
    body: JSON.stringify(mediaUrn ? {
      author: authorUrn, lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: finalContent }, shareMediaCategory: 'IMAGE', media: [{ status: 'READY', media: mediaUrn }] } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    } : {
      author: authorUrn, lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: finalContent }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
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
  const d = await res.json();
  if (!res.ok) throw new Error(`Token: ${JSON.stringify(d)}`);
  return d.access_token;
}

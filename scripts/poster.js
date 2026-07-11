const COMPANY_URL = 'https://www.linkedin.com/company/devcraft-internships/';
const SITE_URL = 'devcraft.fennark.xyz';

export async function postToLinkedin({ content, imageBuffer, refreshToken, clientId, clientSecret, pageId }) {
  if (!refreshToken) throw new Error('Missing LINKEDIN_REFRESH_TOKEN');

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
  console.log('[POST] ✓ Token refreshed');
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  const p = await (await fetch('https://api.linkedin.com/v2/userinfo', { headers })).json();
  const personUrn = `urn:li:person:${p.sub}`;

  let authorUrn = personUrn;
  let isOrg = false;

  if (pageId) {
    const orgUrn = `urn:li:organization:${pageId}`;
    console.log(`[POST] Attempting page post as ${orgUrn}...`);
    const ok = await tryPost(orgUrn, content, imageBuffer, headers);
    if (ok) { console.log(`[POST] ✓ Posted to page`); return; }
    console.log(`[POST] Page post failed, falling back to user + company link...`);
    authorUrn = personUrn;
    isOrg = false;
  }

  const finalContent = isOrg ? content : (content.includes(SITE_URL) ? `${content}\n\n${COMPANY_URL}` : `${content}\n\nRegister free: ${SITE_URL}\n${COMPANY_URL}`);
  const ok = await tryPost(authorUrn, finalContent, imageBuffer, headers);
  if (!ok) throw new Error('Post failed as user too');
  console.log(`[POST] ✓ Posted as user: ${p.sub}`);
}

async function tryPost(authorUrn, content, imageBuffer, headers) {
  let mediaUrn = null;
  if (imageBuffer) {
    try {
      const reg = await (await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
        method: 'POST', headers,
        body: JSON.stringify({ registerUploadRequest: { recipes: ['urn:li:digitalmediaRecipe:feedshare-image'], owner: authorUrn, serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }] } }),
      })).json();
      const uploadUrl = reg.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
      if (uploadUrl) {
        mediaUrn = reg.value.asset;
        await fetch(uploadUrl, { method: 'PUT', headers: { Authorization: headers.Authorization, 'Content-Type': 'image/png' }, body: imageBuffer });
        console.log('[POST] ✓ Image uploaded');
      }
    } catch (err) { console.log(`[POST] Image upload failed: ${err.message}`); }
  }

  const postRes = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST', headers,
    body: JSON.stringify(mediaUrn ? {
      author: authorUrn, lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: content }, shareMediaCategory: 'IMAGE', media: [{ status: 'READY', media: mediaUrn }] } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    } : {
      author: authorUrn, lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: content }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  const result = await postRes.json();
  if (!postRes.ok) {
    console.log(`[POST] Post attempt failed: ${postRes.status} — ${JSON.stringify(result).slice(0, 200)}`);
    return false;
  }
  return true;
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

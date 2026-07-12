const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API = 'https://api.linkedin.com/v2';

async function discoverOrgUrn(accessToken, pageId) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  // Try looking up by vanity name
  const vanityRes = await fetch(`${API}/organizations?q=vanityName&vanityName=devcraft-internships`, { headers });
  if (vanityRes.ok) {
    const data = await vanityRes.json();
    if (data?.elements?.[0]?.id) return `urn:li:organization:${data.elements[0].id}`;
  }
  // Try user's org admin endpoints
  const aclRes = await fetch(`${API}/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR`, { headers });
  if (aclRes.ok) {
    const data = await aclRes.json();
    const entity = data?.elements?.[0]?.organizationalTarget;
    if (entity) return entity;
  }
  // Fallback: use pageId directly
  return `urn:li:organization:${pageId || '134233993'}`;
}

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN } = process.env;
  if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET || !LINKEDIN_REFRESH_TOKEN) {
    throw new Error('Missing LinkedIn OAuth credentials');
  }

  // Step 1: Get access token
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

  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // Discover correct org URN
  console.log('      Looking up organization...');
  const owner = await discoverOrgUrn(accessToken, pageId);
  console.log(`      ✓ Owner: ${owner}`);

  // Step 2: If image URL provided, register upload and upload image
  let mediaAsset = null;
  if (imageUrl) {
    console.log('      Registering image upload...');
    const registerRes = await fetch(`${API}/assets?action=registerUpload`, {
      method: 'POST',
      headers,
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
      console.log(`      Image register failed: ${err.slice(0, 150)}`);
    } else {
      const regData = await registerRes.json();
      const uploadUrl = regData?.value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
      const asset = regData?.value?.asset;
      if (uploadUrl && asset) {
        // Step 3: Upload the image binary
        console.log('      Uploading image binary...');
        const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
        if (imgRes.ok) {
          const imgBuf = await imgRes.arrayBuffer();
          const uploadRes = await fetch(uploadUrl, { method: 'POST', body: imgBuf, signal: AbortSignal.timeout(30000) });
          if (uploadRes.ok) {
            mediaAsset = asset;
            console.log(`      ✓ Image uploaded: ${mediaAsset}`);
          } else {
            const ue = await uploadRes.text().catch(() => '');
            console.log(`      Image binary upload failed: ${ue.slice(0, 100)}`);
          }
        } else {
          console.log(`      Fetching image from URL failed: ${imgRes.status}`);
        }
      } else {
        console.log('      No upload URL in register response');
      }
    }
  }

  // Step 4: Create post
  console.log('      Creating LinkedIn post...');
  const postBody = {
    author: owner,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  if (mediaAsset) {
    postBody.specificContent['com.linkedin.ugc.ShareContent'].media = [{
      status: 'READY',
      description: { text: 'DevCraft Virtual Internship' },
      media: mediaAsset,
      title: { text: 'DevCraft Internship' },
    }];
  }

  const postRes = await fetch(`${API}/ugcPosts`, {
    method: 'POST',
    headers: { ...headers, 'X-Restli-Protocol-Version': '2.0.0' },
    body: JSON.stringify(postBody),
  });

  if (!postRes.ok) {
    const err = await postRes.text().catch(() => '');
    throw new Error(`LinkedIn post failed ${postRes.status}: ${err.slice(0, 300)}`);
  }

  const postUrl = postRes.headers.get('location') || 'success';
  console.log(`[POST] ✓ Company page: ${postUrl}`);
  return postUrl;
}

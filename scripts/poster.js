const LINKEDIN_API = 'https://api.linkedin.com';

let _accessToken = null;

async function getAccessToken({ clientId, clientSecret, refreshToken }) {
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

  _accessToken = data.access_token;
  console.log('[POST] Access token refreshed');
  return data.access_token;
}

async function linkedinFetch(path, options = {}) {
  const res = await fetch(`${LINKEDIN_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${_accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401 && options._retry) throw new Error('Auth failed after retry');
  if (res.status === 401) {
    console.log('[POST] Token expired, refreshing...');
    await getAccessToken(options.creds);
    return linkedinFetch(path, { ...options, _retry: true });
  }

  return res;
}

async function getProfileId() {
  const res = await linkedinFetch('/v2/userinfo');
  const data = await res.json();
  if (!res.ok) throw new Error(`Profile fetch failed: ${JSON.stringify(data)}`);
  return data.sub;
}

async function registerImageUpload(personId) {
  const res = await linkedinFetch('/v2/assets?action=registerUpload', {
    method: 'POST',
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:person:${personId}`,
        serviceRelationships: [{
          relationshipType: 'OWNER',
          identifier: 'urn:li:userGeneratedContent',
        }],
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Image upload registration failed: ${JSON.stringify(data)}`);

  const uploadUrl = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const assetUrn = data.value.asset;

  return { uploadUrl, assetUrn };
}

async function uploadImage(uploadUrl, imageBuffer) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png',
      'Authorization': `Bearer ${_accessToken}`,
    },
    body: imageBuffer,
  });

  if (!res.ok) throw new Error(`Image upload failed: ${res.status}`);
  console.log('[POST] Image uploaded');
}

export async function postToLinkedin(content, imageBuffer, credentials) {
  const { clientId, clientSecret, refreshToken } = credentials;

  console.log('[POST] Authenticating...');
  await getAccessToken({ clientId, clientSecret, refreshToken });

  const personId = await getProfileId();
  console.log(`[POST] Authenticated as user: ${personId}`);

  let assetUrn = null;

  if (imageBuffer) {
    console.log('[POST] Registering image upload...');
    const upload = await registerImageUpload(personId);
    assetUrn = upload.assetUrn;
    await uploadImage(upload.uploadUrl, imageBuffer);
  }

  console.log('[POST] Creating post...');
  const postBody = {
    author: `urn:li:person:${personId}`,
    commentary: content,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (assetUrn) {
    postBody.content = { media: { id: assetUrn } };
  }

  const res = await linkedinFetch('/v2/posts', {
    method: 'POST',
    body: JSON.stringify(postBody),
  });

  const result = await res.json();
  if (!res.ok) throw new Error(`Post failed: ${JSON.stringify(result)}`);

  console.log(`[POST] ✓ Posted: ${result.id}`);
  return result;
}

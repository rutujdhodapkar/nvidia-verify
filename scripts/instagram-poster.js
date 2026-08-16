import 'dotenv/config';

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || 'ak_a7FhWP8nbXN9eS17BpgF';
const BASE = 'https://backend.composio.dev/api/v3';
const USER_ID = 'rutuj';
const IG_CONNECTION_ID = process.env.INSTAGRAM_CONNECTION_ID || 'ca_5EHgv834Mu_D';
const GH_OWNER = process.env.GH_OWNER || process.env.GITHUB_REPOSITORY_OWNER || 'rutujdhodapkar';
const GH_REPO = process.env.GH_REPO || process.env.GITHUB_REPOSITORY?.split('/')[1] || 'nvidia-verify';
const IG_IMAGE_PATH = process.env.IG_IMAGE_PATH || 'images/instagram';
const IG_IMAGE_BRANCH = process.env.IG_IMAGE_BRANCH || 'master';
const OAUTH_SCOPE = 'x-api-key';

async function callComposio(toolSlug, argumentsObj) {
  const res = await fetch(`${BASE}/tools/execute/${toolSlug}`, {
    method: 'POST',
    headers: { [OAUTH_SCOPE]: COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connected_account_id: IG_CONNECTION_ID, user_id: USER_ID, arguments: argumentsObj }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Composio ${toolSlug} ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(`Composio ${toolSlug}: ${json.error}`);
  return json.data;
}

export async function getInstagramUserId() {
  const data = await callComposio('INSTAGRAM_GET_USER_INFO', {});
  const id = data?.id || data?.ig_user_id || data?.data?.id;
  console.log(`[IG] User id: ${id}`);
  return String(id);
}

export async function createMediaContainer({ igUserId, imageUrl, caption }) {
  const data = await callComposio('INSTAGRAM_CREATE_MEDIA_CONTAINER', {
    ig_user_id: igUserId,
    image_url: imageUrl,
    caption: caption,
    content_type: 'photo',
  });
  const creationId = data?.id || data?.creation_id || data?.data?.id;
  if (!creationId) throw new Error('No container id returned: ' + JSON.stringify(data).slice(0, 200));
  console.log(`[IG] Container created: ${creationId}`);
  return String(creationId);
}

export async function createReelContainer({ igUserId, videoUrl, caption, coverUrl }) {
  const data = await callComposio('INSTAGRAM_CREATE_MEDIA_CONTAINER', {
    ig_user_id: igUserId,
    video_url: videoUrl,
    caption: caption,
    cover_url: coverUrl || undefined,
    media_type: 'REELS',
    content_type: 'reel',
  });
  const creationId = data?.id || data?.creation_id || data?.data?.id;
  if (!creationId) throw new Error('No reel container id returned: ' + JSON.stringify(data).slice(0, 200));
  console.log(`[IG] Reel container created: ${creationId}`);
  return String(creationId);
}

export async function publishPost({ igUserId, creationId }) {
  const data = await callComposio('INSTAGRAM_CREATE_POST', {
    ig_user_id: igUserId,
    creation_id: creationId,
  });
  const mediaId = data?.id || data?.data?.id;
  console.log(`[IG] Published media id: ${mediaId}`);
  return String(mediaId);
}

export async function uploadImageToGithub(imageBuffer) {
  return uploadToGithub(imageBuffer, 'png', 'image/png');
}

export async function uploadToGithub(buffer, ext, contentType) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN not set — needed to host the IG media publicly');
  const filename = `ig-${new Date().toISOString().slice(0, 10)}-${Date.now()}.${ext}`;
  const apiPath = `${IG_IMAGE_PATH}/${filename}`;
  const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${apiPath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({
      message: `ci: instagram card ${filename}`,
      content: buffer.toString('base64'),
      branch: IG_IMAGE_BRANCH,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub upload ${res.status}: ${text.slice(0, 200)}`);
  }
  const rawUrl = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${IG_IMAGE_BRANCH}/${apiPath}`;
  console.log(`[IG] Media hosted: ${rawUrl}`);
  return rawUrl;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function postToInstagram({ imageUrl, caption }) {
  const igUserId = process.env.INSTAGRAM_USER_ID || await getInstagramUserId();
  const creationId = await createMediaContainer({ igUserId, imageUrl, caption });

  // Instagram needs a few seconds to process the container before it can be published.
  // Retry with backoff for the transient "media not ready" (9007) race.
  const delays = [6000, 8000, 12000, 20000, 30000];
  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1] || 30000);
    try {
      return await publishPost({ igUserId, creationId });
    } catch (err) {
      const msg = String(err?.message || err);
      const isNotReady = /not ready|not available|9007|not_ready|still processing/i.test(msg);
      if (attempt >= delays.length - 1 || !isNotReady) throw err;
      console.log(`[IG] Media not ready yet — retrying publish in ${delays[attempt]}s (${attempt + 1}/${delays.length})`);
    }
  }
}

export async function postToInstagramReel({ videoUrl, caption, coverUrl }) {
  const igUserId = process.env.INSTAGRAM_USER_ID || await getInstagramUserId();
  const creationId = await createReelContainer({ igUserId, videoUrl, caption, coverUrl });

  // Reels take longer to transcode than photos, so use a longer backoff window.
  const delays = [10000, 15000, 20000, 30000, 45000];
  for (let attempt = 0; ; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1] || 30000);
    try {
      return await publishPost({ igUserId, creationId });
    } catch (err) {
      const msg = String(err?.message || err);
      const isNotReady = /not ready|not available|9007|not_ready|still processing/i.test(msg);
      if (attempt >= delays.length - 1 || !isNotReady) throw err;
      console.log(`[IG] Reel not ready yet — retrying publish in ${delays[attempt]}s (${attempt + 1}/${delays.length})`);
    }
  }
}

export async function generateImageAndPost({ post, imageMeta, caption, apiKey }) {
  const { generateImage } = await import('./image-gen.js');
  const buf = await generateImage({ post, imageMeta, apiKey, format: 'portrait' });
  const imageUrl = process.env.INSTAGRAM_IMAGE_URL || await uploadImageToGithub(buf);
  return postToInstagram({ imageUrl, caption });
}

async function main() {
  const { caption, imageUrl } = {
    caption: process.env.INSTAGRAM_CAPTION,
    imageUrl: process.env.INSTAGRAM_IMAGE_URL,
  };
  if (!caption) {
    console.error('Usage: INSTAGRAM_CAPTION="..." INSTAGRAM_IMAGE_URL="https://..." node scripts/instagram-poster.js');
    process.exit(1);
  }
  const mediaId = imageUrl
    ? await postToInstagram({ imageUrl, caption })
    : await generateImageAndPost({ caption, apiKey: process.env.NVIDIA_API_KEY });
  console.log(`\n=== Done — Instagram post published: ${mediaId} ===`);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('instagram-poster.js')) {
  main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
}
// LinkedIn posting via Composio (same proven pattern as instagram-poster.js)
// IMPORTANT: must use v3.1 — v3 pins a deactivated LinkedIn-API version (426).
const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;
const BASE = 'https://backend.composio.dev/api/v3.1';
const USER_ID = process.env.COMPOSIO_USER_ID || 'rutuj';
// Active connection verified as Rutuj Dhodapkar (urn:li:person:WrAmP1oUE9)
export const LINKEDIN_CONNECTION_ID = process.env.LINKEDIN_CONNECTION_ID || 'ca_aALairrVKGhQ';

async function callComposio(toolSlug, args) {
  if (!COMPOSIO_API_KEY) throw new Error('COMPOSIO_API_KEY not set');
  const res = await fetch(`${BASE}/tools/execute/${toolSlug}`, {
    method: 'POST',
    headers: { 'x-api-key': COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ connected_account_id: LINKEDIN_CONNECTION_ID, user_id: USER_ID, arguments: args }),
    signal: AbortSignal.timeout(45000),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(`Composio ${toolSlug} ${res.status}: ${text.slice(0, 250)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Composio ${toolSlug}: bad JSON`); }
  if (json.error) throw new Error(`Composio ${toolSlug}: ${String(json.error).slice(0, 250)}`);
  return json.data;
}

function extractResponse(data) {
  return data?.response_dict || data?.data?.response_dict || data?.response_data || data;
}

// Company page URN (Fennark page, id verified via LINKEDIN_GET_COMPANY_INFO).
// All posts go here — never the personal profile.
const COMPANY_PAGE_URN = process.env.LINKEDIN_AUTHOR_URN || 'urn:li:organization:134233993';

// Posts a text update on the company page.
export async function createLinkedInPost({ text, authorUrn }) {
  const author = authorUrn || COMPANY_PAGE_URN;
  const raw = await callComposio('LINKEDIN_CREATE_LINKED_IN_POST', {
    author,
    commentary: text,
    visibility: 'PUBLIC',
  });
  const d = extractResponse(raw);
  const postId = d?.id || d?.post_id || d?.activity_id || '';
  console.log(`[POST] ✓ Via Composio${author.includes('organization') ? ' (company page)' : ' (personal)'}`);
  return { ok: true, postId: String(postId), author };
}

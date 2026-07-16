const BASE_URL = process.env.PORTFOLIO_FIREBASE_URL || 'https://portfolio-cfe62-default-rtdb.firebaseio.com';

async function pfFetch(path, method = 'GET', body = null) {
  const url = `${BASE_URL}/${path}.json`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok && res.status !== 404) throw new Error(`Portfolio FB ${method} ${path}: ${res.status}`);
  if (method === 'DELETE') return null;
  if (res.status === 404) return null;
  return res.json().catch(() => null);
}

export async function pfGet(path) { return pfFetch(path, 'GET'); }

export async function pfPut(path, data) { return pfFetch(path, 'PUT', data); }

export async function pfPatch(path, data) { return pfFetch(path, 'PATCH', data); }

export async function pfDelete(path) { return pfFetch(path, 'DELETE'); }

export async function pfPush(path, data) {
  const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await pfPut(`${path}/${key}`, data);
  return key;
}

export function encodeKey(str) {
  return (str || '').toLowerCase().replace(/[.#$\/\[\]]/g, '_');
}

export async function removeBlockedEmails(emails) {
  const allKeys = [];
  const paths = ['queue', 'sent', 'failed', 'blocked', 'emailCategories'];
  for (const path of paths) {
    const data = await pfGet(path);
    if (!data || typeof data !== 'object') continue;
    for (const key of Object.keys(data)) {
      const item = data[key];
      const itemEmail = item?.email || item?.key || key;
      if (emails.some(e => encodeKey(e) === encodeKey(key) || encodeKey(e) === encodeKey(itemEmail))) {
        allKeys.push({ path, key });
      }
    }
  }
  for (const { path, key } of allKeys) {
    await pfDelete(`${path}/${encodeKey(key)}`);
    console.log(`  Deleted ${path}/${key}`);
  }
  return allKeys.length;
}

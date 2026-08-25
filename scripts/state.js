const FIREBASE_URL = 'https://laptop-privacy-default-rtdb.firebaseio.com';

export async function loadState() {
  const res = await fetch(`${FIREBASE_URL}/state.json`);
  if (res.status === 404) return { previousPosts: [], postHashes: [], lastRun: null };
  const data = await res.json();
  return data || { previousPosts: [], postHashes: [], lastRun: null };
}

export async function saveState(state) {
  await fetch(`${FIREBASE_URL}/state.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
}

export function hash(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) { h = ((h << 5) - h) + t.charCodeAt(i); h |= 0; }
  return h.toString(16);
}

export function isDup(post, state) {
  const h = hash(post.slice(0, 100));
  if (state.postHashes.includes(h)) return true;
  for (const prev of state.previousPosts) {
    const words = [...new Set(post.toLowerCase().match(/\b\w{4,}\b/g) || [])];
    const prevWords = [...new Set(prev.toLowerCase().match(/\b\w{4,}\b/g) || [])];
    const common = words.filter(w => prevWords.includes(w)).length;
    if (common / Math.max(1, Math.min(words.length, prevWords.length)) > 0.75) return true;
  }
  return false;
}

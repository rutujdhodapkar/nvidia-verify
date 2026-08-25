import { CosmosClient } from '@azure/cosmos';
import { fbGet, fbPut } from './firebase.js';

const COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'devcraft';
const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER || 'main';
const SYNC_INTERVAL_DAYS = Number(process.env.MIRROR_SYNC_DAYS || 7);

function fbSafe(value) {
  if (Array.isArray(value)) return value.map((v) => fbSafe(v));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const safeKey = String(k).replace(/[.#$\/\[\]]/g, '_').slice(0, 768) || '_empty';
      out[safeKey] = fbSafe(v);
    }
    return out;
  }
  return value;
}

export function isStale(meta) {
  if (!meta?.lastSyncAt) return true;
  const ageDays = (Date.now() - new Date(meta.lastSyncAt).getTime()) / 86400000;
  return ageDays >= SYNC_INTERVAL_DAYS;
}

export async function getMirrorMeta() {
  return (await fbGet('mirror/meta')) || { lastSyncAt: null, counts: {}, docCount: 0 };
}

export async function syncMirror({ force = false } = {}) {
  const meta = await getMirrorMeta();
  if (!force && !isStale(meta)) {
    console.log(`[mirror] fresh (${meta.lastSyncAt}), skipping Cosmos`);
    return { skipped: true, meta };
  }

  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) throw new Error('COSMOS_DB_CONNECTION_STRING not set');
  const client = new CosmosClient(connStr);
  const container = client.database(COSMOS_DATABASE).container(COSMOS_CONTAINER);

  console.log('[mirror] querying Cosmos (single weekly read)...');
  const { resources } = await container.items.readAll().fetchAll();
  const grouped = {};
  let total = 0;
  for (const doc of resources) {
    const type = doc.entityType || 'unknown';
    if (!grouped[type]) grouped[type] = {};
    grouped[type][doc.id.replace(/[.#$\/\[\]]/g, '_')] = fbSafe(doc);
    total++;
  }

  for (const [type, docs] of Object.entries(grouped)) {
    await fbPut(`mirror/${type}`, docs);
  }
  for (const type of Object.keys(meta.counts || {})) {
    if (!grouped[type]) await fbPut(`mirror/${type}`, null);
  }

  const newMeta = {
    lastSyncAt: new Date().toISOString(),
    counts: Object.fromEntries(Object.entries(grouped).map(([t, d]) => [t, Object.keys(d).length])),
    docCount: total,
    nextSyncAfter: new Date(Date.now() + SYNC_INTERVAL_DAYS * 86400000).toISOString().slice(0, 10),
  };
  await fbPut('mirror/meta', newMeta);
  console.log(`[mirror] synced ${total} docs → Firebase: ${JSON.stringify(newMeta.counts)}`);
  return { skipped: false, meta: newMeta };
}

export async function getCachedEnrollments() {
  const data = await fbGet('mirror/enrollments');
  if (!data) return [];
  return Object.values(data);
}

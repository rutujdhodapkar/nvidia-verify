import 'dotenv/config';
import { readFileSync } from 'fs';
import { pfGet, pfPatch, encodeKey } from '../lib/portfolio-firebase.js';
import { isBlocked, BLOCKED_EMAILS } from '../lib/blocklist.js';

const BATCH_SIZE = 500;

const DRY_RUN = process.argv.includes('--dry-run');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Known test / placeholder accounts that must never be emailed.
const TEST_EMAILS = new Set([
  'admin@admin.com',
  'test123@gmail.com',
  'iiitest94@gmail.com',
].map(e => e.toLowerCase()));

function parseLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function loadExistingKeys() {
  const keys = new Set();
  for (const path of ['queue', 'sent']) {
    const data = await pfGet(path);
    if (data && typeof data === 'object') {
      for (const key of Object.keys(data)) keys.add(encodeKey(key));
    }
  }
  return keys;
}

async function pushBatch(batch) {
  if (DRY_RUN) return batch.length;
  const data = {};
  for (const item of batch) {
    const key = encodeKey(item.email);
    data[key] = { name: item.name, email: item.email, addedAt: new Date().toISOString(), source: 'csv' };
  }

  const res = await fetch('https://portfolio-cfe62-default-rtdb.firebaseio.com/queue.json', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firebase error ${res.status}: ${err}`);
  }
  return Object.keys(data).length;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/load-contacts.js <path-to-csv>');
    process.exit(1);
  }

  console.log('Fetching existing queue/sent keys...');
  const existing = await loadExistingKeys();
  console.log(`  ${existing.size} existing keys (queue + sent) already in firebase.\n`);

  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    console.error('CSV must have a header and at least one row');
    process.exit(1);
  }

  const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');

  if (nameIdx === -1 || emailIdx === -1) {
    console.error('CSV must have "name" and "email" columns');
    process.exit(1);
  }

  const seen = new Set();
  let total = 0;
  let skipped = 0;
  let skippedExisting = 0;
  let skippedBlocked = 0;
  let skippedInvalid = 0;
  let batch = [];

  const flush = async (force = false) => {
    if (!force && batch.length < BATCH_SIZE) return;
    if (batch.length === 0) return;
    const count = await pushBatch(batch);
    total += count;
    console.log(`  ${total} contacts loaded...`);
    batch = [];
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const name = (cols[nameIdx] || '').replace(/^"|"$/g, '').trim();
    const email = (cols[emailIdx] || '').replace(/^"|"$/g, '').trim();

    if (!email) { skipped++; continue; }

    const key = encodeKey(email);

    if (!EMAIL_RE.test(email)) { skippedInvalid++; skipped++; continue; }
    if (TEST_EMAILS.has(email.toLowerCase())) { skippedInvalid++; skipped++; continue; }
    if (isBlocked(email)) { skippedBlocked++; skipped++; continue; }
    if (seen.has(key) || existing.has(key)) { skippedExisting++; skipped++; continue; }

    seen.add(key);
    batch.push({ name: name || 'Unknown', email });
    await flush();
  }

  await flush(true);

  console.log(`\nDone! Loaded ${total} contacts into Queue.`);
  console.log(`Skipped ${skipped} (${skippedExisting} already in queue/sent, ${skippedBlocked} blocked, ${skippedInvalid} invalid).`);

  if (DRY_RUN) {
    console.log('\n  \u{1F7E1} DRY RUN \u2014 no contacts were written to firebase.');
    return;
  }

  // Persist blocked list reference for future runs (no-op safety net).
  await pfPatch('meta', { blockedEmailList: Array.from(BLOCKED_EMAILS) });
}

main().catch(err => { console.error(err); process.exit(1); });

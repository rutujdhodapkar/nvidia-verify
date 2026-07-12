import 'dotenv/config';
import { readFileSync } from 'fs';

const FIREBASE_URL = 'https://portfolio-cfe62-default-rtdb.firebaseio.com';

async function pushToQueue(name, email) {
  const res = await fetch(`${FIREBASE_URL}/queue.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, addedAt: new Date().toISOString() }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firebase error ${res.status}: ${err}`);
  }
  return res.json();
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/load-contacts.js <path-to-csv>');
    process.exit(1);
  }

  const raw = readFileSync(csvPath, 'utf-8').trim();
  const lines = raw.split('\n');
  if (lines.length < 2) {
    console.error('CSV must have a header and at least one row');
    process.exit(1);
  }

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');

  if (nameIdx === -1 || emailIdx === -1) {
    console.error('CSV must have "name" and "email" columns');
    process.exit(1);
  }

  let total = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    const name = cols[nameIdx];
    const email = cols[emailIdx];

    if (!email) { skipped++; continue; }

    try {
      await pushToQueue(name || 'Unknown', email);
      total++;
      if (total % 100 === 0) console.log(`  ${total} contacts loaded...`);
    } catch (err) {
      console.error(`Failed to push ${email}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`\nDone! Loaded ${total} contacts into Queue. Skipped ${skipped}.`);
}

main().catch(err => { console.error(err); process.exit(1); });

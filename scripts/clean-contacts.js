import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { isBlocked } from '../lib/blocklist.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = process.argv[2] || resolve(__dirname, '../../all_accounts.csv');
const OUTPUT = process.argv[3] || resolve(__dirname, '../../all_accounts_clean.csv');

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

function normName(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function main() {
  const raw = readFileSync(INPUT, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV must have a header and at least one row');

  const headers = parseLine(lines[0]);
  const idx = {};
  for (const h of ['name', 'email', 'mobile', 'domain', 'batch', 'college']) {
    idx[h] = headers.indexOf(h);
    if (idx[h] === -1) throw new Error(`Missing column: ${h}`);
  }

  const seenEmail = new Map();      // email -> row (kept first)
  const seenMobileName = new Map(); // mobile|name -> row
  const removed = { invalid: 0, test: 0, blocked: 0, dupEmail: 0, dupMobileName: 0 };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length < headers.length) continue;

    const email = (cols[idx.email] || '').trim();
    const name = (cols[idx.name] || '').trim();
    const mobile = (cols[idx.mobile] || '').trim();
    const row = {
      name,
      email,
      mobile,
      domain: (cols[idx.domain] || '').trim(),
      batch: (cols[idx.batch] || '').trim(),
      college: (cols[idx.college] || '').trim(),
    };

    if (!email) { removed.invalid++; continue; }

    const ekey = email.toLowerCase();
    if (!EMAIL_RE.test(email)) { removed.invalid++; continue; }
    if (TEST_EMAILS.has(ekey)) { removed.test++; continue; }
    if (isBlocked(email)) { removed.blocked++; continue; }

    // Same email (case-insensitive) → keep first.
    if (seenEmail.has(ekey)) { removed.dupEmail++; continue; }

    // Same mobile + same name → almost certainly the same person re-registered.
    if (mobile && name) {
      const mkey = `${mobile}|${normName(name)}`;
      if (seenMobileName.has(mkey)) { removed.dupMobileName++; continue; }
      seenMobileName.set(mkey, row);
    }

    seenEmail.set(ekey, row);
  }

  const clean = Array.from(seenEmail.values());
  const csv = [
    ['name', 'email', 'mobile', 'domain', 'batch', 'college'].join(','),
    ...clean.map(r => [
      r.name.replace(/"/g, '""'),
      r.email,
      r.mobile,
      r.domain.replace(/"/g, '""'),
      r.batch.replace(/"/g, '""'),
      r.college.replace(/"/g, '""'),
    ].join(',')),
  ].join('\n');

  writeFileSync(OUTPUT, csv + '\n', 'utf-8');

  console.log(`Input rows (excl header): ${lines.length - 1}`);
  console.log(`Clean unique emails:     ${clean.length}`);
  console.log('');
  console.log('Removed:');
  console.log(`  invalid email:       ${removed.invalid}`);
  console.log(`  test/placeholder:    ${removed.test}`);
  console.log(`  blocked:             ${removed.blocked}`);
  console.log(`  duplicate email:     ${removed.dupEmail}`);
  console.log(`  same mobile+name:    ${removed.dupMobileName}`);
  console.log(`  total removed:       ${removed.invalid + removed.test + removed.blocked + removed.dupEmail + removed.dupMobileName}`);
  console.log('');
  console.log(`Wrote: ${OUTPUT}`);
}

main();

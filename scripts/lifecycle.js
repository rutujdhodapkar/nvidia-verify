import 'dotenv/config';
import { getCachedEnrollments } from '../lib/cosmos-cache.js';
import { fbGet, fbPut, fbPatch } from '../lib/firebase.js';
import { sendResendEmail } from '../lib/resend.js';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || (process.argv.includes('--sandbox') ? process.argv[process.argv.indexOf('--sandbox') + 1] : null);
const SEND_DELAY_MS = Number(process.env.SEND_MIN_DELAY_MS || 2000);

function encodeKey(str) { return String(str || '').trim().toLowerCase().replace(/[.#$\/\[\]]/g, '_'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

async function deliver({ to, toName, subject, text }) {
  const email = String(to || '').trim();
  if (!email || !email.includes('@')) return false;
  const target = SANDBOX_EMAIL || email;
  if (DRY_RUN) { console.log(`  ○ [dry-run] ${email} ← ${subject}`); return true; }
  try {
    const r = await sendResendEmail({ to: target, toName, subject, text });
    console.log(`  ✓ ${email} ← ${subject} (${r.messageId})`);
    await new Promise((res) => setTimeout(res, SEND_DELAY_MS));
    return true;
  } catch (err) {
    console.log(`  ✗ ${email}: ${err.message}`);
    return false;
  }
}

function taskStats(doc) {
  const projects = doc.projects || [];
  const subs = doc.submissions || {};
  let total = 0, verified = 0, lastVerifiedAt = null;
  for (let i = 0; i < projects.length; i++) {
    total++;
    const s = subs[i];
    if (s?.verified) {
      verified++;
      const t = s.verifiedAt || s.submittedAt;
      if (t && (!lastVerifiedAt || t > lastVerifiedAt)) lastVerifiedAt = t;
    }
  }
  return { total, verified, complete: total > 0 && verified === total, lastVerifiedAt };
}

async function loadConfig() {
  const cfg = (await fbGet('lifecycle/config')) || {};
  return {
    nps: { enabled: true, ...(cfg.nps || {}) },
  };
}

async function runNpsSurvey(enrollments, config) {
  console.log('\n[nps-survey]');
  if (!config.nps.enabled) { console.log('  ⏸ disabled'); return; }
  const state = (await fbGet('lifecycle/nps')) || {};
  const seenThisRun = new Set();
  let sent = 0;

  for (const e of enrollments) {
    if (!e.email) continue;
    const key = encodeKey(e.email);
    if (seenThisRun.has(key)) continue;
    const stats = taskStats(e);
    const completedAt = e.completedAt || stats.lastVerifiedAt;
    const isDone = stats.complete || String(e.status).toLowerCase() === 'completed';
    if (!isDone || !completedAt) continue;
    if (daysSince(completedAt) < 7) continue;
    if (state[key]?.surveySent) continue;
    seenThisRun.add(key);

    const ok = await deliver({
      to: e.email, toName: e.name,
      subject: '30 seconds? One question about your internship',
      text: [
        `Hi ${e.name || 'there'},`,
        '',
        `You finished the ${e.domain || 'DEV/CRAFT'} internship about a week ago. Quick one:`,
        '',
        'How likely are you to recommend DEV/CRAFT to a friend? Score from 0 (never) to 10 (absolutely).',
        '',
        'Just reply to this email with a number.',
        '',
        'Honest beats nice. If it was an 8 or below, tell us what fell short — that is the feedback we act on.',
        '',
        '— Rutuj, DEV/CRAFT',
      ].join('\n'),
    });
    if (ok) {
      state[key] = { ...(state[key] || {}), surveySent: todayStr(), email: e.email.trim() };
      await fbPatch(`lifecycle/nps/${key}`, state[key]);
      sent++;
    }
  }
  console.log(`  → ${sent} surveys sent`);
}

async function recordNps(email, score) {
  const key = encodeKey(email);
  await fbPut(`nps/scores/${key}`, { email: email.trim(), score: Number(score), recordedAt: new Date().toISOString() });
  await fbPatch(`lifecycle/nps/${key}`, { score: Number(score), scoreRecordedAt: new Date().toISOString() });
  console.log(`[nps] recorded ${score}/10 for ${email}`);
}

async function main() {
  console.log(`[lifecycle] ${todayStr()} dry-run=${DRY_RUN} sandbox=${SANDBOX_EMAIL || 'off'}`);

  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const cmd = positional.find((a) => a !== process.argv[1]?.split('/').pop()) || positional[0];

  if (cmd === 'nps-record') {
    const email = positional[1], score = positional[2];
    if (!email || !score) { console.error('Usage: npm run lifecycle -- nps-record <email> <0-10>'); process.exit(1); }
    await recordNps(email, score);
    return;
  }

  const config = await loadConfig();
  const enrollments = await getCachedEnrollments();
  if (!enrollments.length) {
    console.log('[lifecycle] mirror empty — run `npm run sync-mirror -- --force` first');
    return;
  }
  console.log(`[lifecycle] ${enrollments.length} enrollments loaded from Firebase mirror (0 Cosmos reads)`);

  await runNpsSurvey(enrollments, config);

  await fbPut('lifecycle/last-run', { at: new Date().toISOString(), dryRun: DRY_RUN, count: enrollments.length });
  console.log('\n[lifecycle] done');
}

main().catch((err) => { console.error(`[lifecycle] FAILED: ${err.message}`); process.exit(1); });

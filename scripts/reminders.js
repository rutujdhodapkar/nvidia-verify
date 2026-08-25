import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { sendResendEmail } from '../lib/resend.js';
import { fbGet, fbPut, fbPatch } from '../lib/firebase.js';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || (process.argv.includes('--sandbox') ? process.argv[process.argv.indexOf('--sandbox') + 1] : null);
const FORCE = process.argv.includes('--force');
const CYCLE_DAYS = Number(process.env.REMINDER_CYCLE_DAYS || 10);
const COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'devcraft';
const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER || 'main';

function encodeKey(str) { return String(str || '').trim().toLowerCase().replace(/[.#$\/\[\]]/g, '_'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

async function shouldRun() {
  if (FORCE) return true;
  const meta = (await fbGet('reminders/meta')) || {};
  if (!meta.lastCycleAt) return true;
  const days = (Date.now() - new Date(meta.lastCycleAt).getTime()) / 86400000;
  if (days < CYCLE_DAYS) {
    console.log(`[reminders] next cycle in ${Math.ceil(CYCLE_DAYS - days)} days (last: ${meta.lastCycleAt})`);
    return false;
  }
  return true;
}

async function readCosmosEnrollments() {
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) throw new Error('COSMOS_DB_CONNECTION_STRING not set');
  const client = new CosmosClient(connStr);
  const container = client.database(COSMOS_DATABASE).container(COSMOS_CONTAINER);
  const query = "SELECT * FROM c WHERE c.entityType = 'enrollments'";
  const { resources } = await container.items.query(query).fetchAll();
  console.log(`[reminders] Cosmos read: ${resources.length} enrollments`);
  return resources;
}

async function deliver({ to, toName, subject, text }) {
  const email = String(to || '').trim();
  if (!email || !email.includes('@')) return false;
  const target = SANDBOX_EMAIL || email;
  if (DRY_RUN) { console.log(`  ○ [dry-run] ${email} ← ${subject}`); return true; }
  try {
    const r = await sendResendEmail({ to: target, toName, subject, text });
    console.log(`  ✓ ${email} ← ${subject} (${r.messageId})`);
    await fbPatch(`reminders/sent/${encodeKey(email)}`, { lastSubject: subject, lastSentAt: new Date().toISOString(), messageId: r.messageId });
    return true;
  } catch (err) {
    console.log(`  ✗ ${email}: ${err.message}`);
    return false;
  }
}

async function runPaymentReminders(enrollments) {
  console.log('\n[payment-reminders]');
  const state = (await fbGet('lifecycle/payment')) || {};
  const cfg = (await fbGet('reminders/config')) || {};
  const domains = (cfg.paymentDomains || []).map((d) => String(d).toUpperCase());
  const seenThisRun = new Set();
  let sent = 0;

  for (const e of enrollments) {
    if (!e.email) continue;
    const key = encodeKey(e.email);
    if (seenThisRun.has(key)) continue;
    if (e.transactionId || e.paymentStatus === 'completed') continue;
    if (String(e.status || '').toLowerCase() !== 'active') continue;
    if (domains.length && !domains.includes(String(e.domain || '').toUpperCase())) continue;
    const age = daysSince(e.createdAt);
    if (age === null || age < 3 || age > 30) continue;
    seenThisRun.add(key);

    const st = state[key] || {};

    let subject, body;
    if (age >= 23 && !st.stage3 && st.stage2) {
      subject = `${(e.name || 'There').split(' ')[0]} — final notice before we release your seat`;
      body = [
        'This is our last email about this. Tomorrow your seat is released to the waitlist.',
        '',
        'If you still want in: https://devcraft.fennark.xyz',
        'If not, ignore this and we will close your application quietly.',
      ];
    } else if (age >= 13 && !st.stage2 && st.stage1) {
      subject = `${(e.name || 'There').split(' ')[0]}, your DEV/CRAFT seat is still on hold`;
      body = [
        `Your enrollment has been pending payment for ${age} days.`,
        '',
        'We can only hold it a little longer.',
        'Complete here: https://devcraft.fennark.xyz',
        '',
        'Card declined or UPI failed? Reply to this email — we will fix it together.',
      ];
    } else if (age >= 3 && !st.stage1) {
      subject = `${(e.name || 'There').split(' ')[0]}, finish your DEV/CRAFT enrollment`;
      body = [
        'Your enrollment is almost done — only the program fee is pending.',
        `Your seat stays reserved for the next few days.`,
        '',
        'Complete it here: https://devcraft.fennark.xyz',
        '',
        'Questions? Just reply to this email. A human reads every reply.',
      ];
    } else continue;

    const ok = await deliver({
      to: e.email, toName: e.name, subject,
      text: [`Hi ${e.name || 'there'},`, '', `Your enrollment in the ${e.domain || 'DEV/CRAFT'} internship is waiting on one step.`, '', ...body, '', '— Rutuj, DEV/CRAFT'].join('\n'),
    });
    if (ok) {
      const stage = age >= 23 ? 'stage3' : age >= 13 ? 'stage2' : 'stage1';
      state[key] = { ...st, [stage]: todayStr() };
      sent++;
      await fbPatch(`lifecycle/payment/${key}`, state[key]);
    }
  }
  console.log(`  → ${sent} payment reminders sent`);
}

async function runAbandonedRecovery(enrollments) {
  console.log('\n[abandoned-recovery]');
  const state = (await fbGet('lifecycle/abandoned')) || {};
  const seenThisRun = new Set();
  let sent = 0;

  for (const e of enrollments) {
    if (!e.email) continue;
    const key = encodeKey(e.email);
    if (seenThisRun.has(key)) continue;
    const age = daysSince(e.createdAt);
    if (age === null || age < 2 || age > 30) continue;
    const incomplete = !e.internId || !(e.projects || []).length;
    if (!incomplete || e.transactionId) continue;
    seenThisRun.add(key);

    const st = state[key] || {};

    let subject, body;
    if (!st.first && age >= 2) {
      subject = 'Did something stop you mid-signup?';
      body = [
        'We saw you start signing up for a DEV/CRAFT internship but did not finish.',
        '',
        'Most common blockers:',
        '- Not sure which domain fits you? Reply with your branch + year, we will suggest one.',
        '- Stuck on the form? Direct link: https://devcraft.fennark.xyz',
        '- Just exploring? No problem — reply with any question.',
        '',
        'Takes 2 minutes to finish.',
      ];
    } else if (!st.second && st.first && age >= 12) {
      subject = 'Your DEV/CRAFT signup is still open';
      body = [
        'Your application is still open and unfinished. We are holding your spot.',
        '',
        'Finish here: https://devcraft.fennark.xyz',
        '',
        'If you decided this is not for you, no hard feelings — reply "remove" and we will close your application.',
      ];
    } else continue;

    const ok = await deliver({
      to: e.email, toName: e.name, subject,
      text: [`Hi ${e.name || 'there'},`, '', ...body, '', '— Rutuj, DEV/CRAFT'].join('\n'),
    });
    if (ok) {
      state[key] = { ...st, [st.first ? 'second' : 'first']: todayStr() };
      sent++;
      await fbPatch(`lifecycle/abandoned/${key}`, state[key]);
    }
  }
  console.log(`  → ${sent} recovery emails sent`);
}

async function main() {
  console.log(`[reminders] cycle=${CYCLE_DAYS}d dry-run=${DRY_RUN} sandbox=${SANDBOX_EMAIL || 'off'}`);
  if (!(await shouldRun())) return;

  const enrollments = await readCosmosEnrollments();

  await runPaymentReminders(enrollments);
  await runAbandonedRecovery(enrollments);

  await fbPut('reminders/meta', { lastCycleAt: new Date().toISOString(), lastRunDate: todayStr(), count: enrollments.length });
  console.log('\n[reminders] done — next cycle in ' + CYCLE_DAYS + ' days');
}

main().catch((err) => { console.error(`[reminders] FAILED: ${err.message}`); process.exit(1); });

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { sendEmail } from '../lib/mailjet.js';
import {
  welcomeEmail,
  offerLetterEmail,
  paymentConfirmationEmail,
  taskReminderEmail,
  preExpiryEmail,
  completionCertificateEmail,
} from '../lib/email-templates.js';

const COSMOS_DATABASE = 'devcraft';
const COSMOS_CONTAINER = 'main';
const FROM_EMAIL = 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || null;
const IS_PROD = process.env.NODE_ENV === 'production';

function resolveEmail(original) {
  if (DRY_RUN) return null;
  if (SANDBOX_EMAIL) return SANDBOX_EMAIL;
  return original;
}

function logSend(label, enrollment, details = '') {
  const to = DRY_RUN ? '[DRY-RUN]' : (SANDBOX_EMAIL ? `${enrollment.email} → ${SANDBOX_EMAIL}` : enrollment.email);
  console.log(`  ${DRY_RUN ? '◇' : '✓'} ${label}: ${to} ${details}`);
}

function getCosmosClient() {
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) throw new Error('COSMOS_DB_CONNECTION_STRING not set');
  return new CosmosClient(connStr);
}

function cleanDoc(doc) {
  if (!doc) return null;
  const { entityType, _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
}

async function listEnrollments(container) {
  const query = "SELECT * FROM c WHERE c.entityType = 'enrollments'";
  const { resources } = await container.items.query(query).fetchAll();
  return resources.map((r) => ({ id: r.id, ...cleanDoc(r) }));
}

async function updateEnrollment(container, id, updates) {
  try {
    const { resource: existing } = await container.item(id, 'enrollments').read();
    if (!existing) { console.warn(`  Enrollment ${id} not found`); return; }
    const merged = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let obj = merged;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in obj) || typeof obj[parts[i]] !== 'object') obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        merged[key] = value;
      }
    }
    await container.item(id, 'enrollments').replace(merged);
  } catch (err) {
    console.error(`  Failed to update enrollment ${id}: ${err.message}`);
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function getTaskStats(projects, submissions) {
  let totalTasks = 0;
  let completedTasks = 0;
  let pendingTasks = 0;
  let lastSubmittedAt = null;

  for (let i = 0; i < (projects || []).length; i++) {
    totalTasks++;
    const sub = (submissions || {})[i];
    if (sub && sub.verified) {
      completedTasks++;
    } else {
      pendingTasks++;
      if (sub && sub.submittedAt && (!lastSubmittedAt || sub.submittedAt > lastSubmittedAt)) {
        lastSubmittedAt = sub.submittedAt;
      }
    }
  }

  return { totalTasks, completedTasks, pendingTasks, lastSubmittedAt };
}

async function sendWelcomeEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.welcomeSent) continue;
    const to = resolveEmail(e.email);
    if (!to) { logSend('◇ Welcome', e, '[DRY-RUN]'); sent++; continue; }
    try {
      const tpl = welcomeEmail({ name: e.name || 'Intern', email: e.email });
      await sendEmail({ to, toName: e.name, subject: tpl.subject, html: tpl.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      if (!SANDBOX_EMAIL) await updateEnrollment(container, e.id, { 'mailjet.welcomeSent': true, 'mailjet.welcomeSentAt': new Date().toISOString() });
      logSend('Welcome', e);
      sent++;
    } catch (err) {
      console.error(`  ✗ Welcome failed for ${e.email}: ${err.message}`);
      stats.errors++;
    }
  }
  return sent;
}

async function sendOfferLetterEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.offerLetterSent) continue;
    if (!e.internId || !e.domain) continue;
    const to = resolveEmail(e.email);
    if (!to) { logSend('◇ Offer letter', e, `[DRY-RUN] ${e.internId}`); sent++; continue; }
    try {
      const tpl = offerLetterEmail({ name: e.name || 'Intern', email: e.email, internId: e.internId, domain: e.domain });
      await sendEmail({ to, toName: e.name, subject: tpl.subject, html: tpl.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      if (!SANDBOX_EMAIL) await updateEnrollment(container, e.id, { 'mailjet.offerLetterSent': true, 'mailjet.offerLetterSentAt': new Date().toISOString() });
      logSend('Offer letter', e, e.internId);
      sent++;
    } catch (err) {
      console.error(`  ✗ Offer letter failed for ${e.email}: ${err.message}`);
      stats.errors++;
    }
  }
  return sent;
}

async function sendPaymentConfirmationEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.paymentSent) continue;
    if (!e.paymentStatus || e.paymentStatus !== 'completed') continue;
    if (!e.internId) continue;
    const to = resolveEmail(e.email);
    if (!to) { logSend('◇ Payment', e, '[DRY-RUN]'); sent++; continue; }
    try {
      const tpl = paymentConfirmationEmail({
        name: e.name || 'Intern', email: e.email, amount: e.paymentAmount, paymentId: e.paymentId, internId: e.internId, domain: e.domain,
      });
      await sendEmail({ to, toName: e.name, subject: tpl.subject, html: tpl.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      if (!SANDBOX_EMAIL) await updateEnrollment(container, e.id, { 'mailjet.paymentSent': true, 'mailjet.paymentSentAt': new Date().toISOString() });
      logSend('Payment', e);
      sent++;
    } catch (err) {
      console.error(`  ✗ Payment email failed for ${e.email}: ${err.message}`);
      stats.errors++;
    }
  }
  return sent;
}

async function sendTaskReminderEmails(container, enrollments, stats) {
  let sent = 0;
  const today = todayStr();

  for (const e of enrollments) {
    if (!e.internId) continue;

    const projects = e.projects || [];
    const submissions = e.submissions || {};
    const { pendingTasks, lastSubmittedAt } = getTaskStats(projects, submissions);

    if (pendingTasks === 0) continue;

    const lastReminderSentAt = e.mailjet?.lastTaskReminderSentAt;
    const daysSinceLastReminder = lastReminderSentAt ? daysBetween(lastReminderSentAt, today) : Infinity;

    if (daysSinceLastReminder < 4) continue;

    const daysSinceActivity = lastSubmittedAt ? daysBetween(lastSubmittedAt, today) : null;
    const to = resolveEmail(e.email);
    if (!to) { logSend('◇ Task reminder', e, `[DRY-RUN] ${pendingTasks} pending`); sent++; continue; }

    try {
      const tpl = taskReminderEmail({
        name: e.name || 'Intern', email: e.email, pendingTasks, daysSinceLastActivity: daysSinceActivity, internId: e.internId,
      });
      await sendEmail({ to, toName: e.name, subject: tpl.subject, html: tpl.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      if (!SANDBOX_EMAIL) await updateEnrollment(container, e.id, { 'mailjet.lastTaskReminderSentAt': new Date().toISOString() });
      logSend('Task reminder', e, `${pendingTasks} pending`);
      sent++;
    } catch (err) {
      console.error(`  ✗ Task reminder failed for ${e.email}: ${err.message}`);
      stats.errors++;
    }
  }
  return sent;
}

async function sendPreExpiryEmails(container, enrollments, stats) {
  let sent = 0;
  const today = todayStr();

  for (const e of enrollments) {
    if (!e.internId) continue;
    if (!e.endDate && !e.internshipEndDate) continue;

    const endDate = e.endDate || e.internshipEndDate;
    const daysUntilEnd = daysBetween(today, endDate);

    if (daysUntilEnd !== 5) continue;
    if (e.mailjet?.preExpirySent) continue;

    const projects = e.projects || [];
    const submissions = e.submissions || {};
    const { pendingTasks } = getTaskStats(projects, submissions);

    if (pendingTasks === 0) continue;

    const to = resolveEmail(e.email);
    if (!to) { logSend('◇ Pre-expiry', e, `[DRY-RUN] ends ${endDate}`); sent++; continue; }

    try {
      const tpl = preExpiryEmail({
        name: e.name || 'Intern', email: e.email, internId: e.internId, domain: e.domain || 'N/A', endDate, remainingTasks: pendingTasks,
      });
      await sendEmail({ to, toName: e.name, subject: tpl.subject, html: tpl.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      if (!SANDBOX_EMAIL) await updateEnrollment(container, e.id, { 'mailjet.preExpirySent': true, 'mailjet.preExpirySentAt': new Date().toISOString() });
      logSend('Pre-expiry', e, `ends ${endDate}`);
      sent++;
    } catch (err) {
      console.error(`  ✗ Pre-expiry failed for ${e.email}: ${err.message}`);
      stats.errors++;
    }
  }
  return sent;
}

async function sendCompletionEmails(container, enrollments, stats) {
  let sent = 0;

  for (const e of enrollments) {
    if (e.mailjet?.completionSent) continue;
    if (!e.internId) continue;

    const projects = e.projects || [];
    const submissions = e.submissions || {};
    const { totalTasks, completedTasks } = getTaskStats(projects, submissions);

    if (totalTasks === 0 || completedTasks < totalTasks) continue;

    const to = resolveEmail(e.email);
    if (!to) { logSend('◇ Completion', e, '[DRY-RUN]'); sent++; continue; }

    try {
      const tpl = completionCertificateEmail({ name: e.name || 'Intern', email: e.email, internId: e.internId, domain: e.domain || 'N/A' });
      await sendEmail({ to, toName: e.name, subject: tpl.subject, html: tpl.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      if (!SANDBOX_EMAIL) await updateEnrollment(container, e.id, { 'mailjet.completionSent': true, 'mailjet.completionSentAt': new Date().toISOString() });
      logSend('Completion', e);
      sent++;
    } catch (err) {
      console.error(`  ✗ Completion email failed for ${e.email}: ${err.message}`);
      stats.errors++;
    }
  }
  return sent;
}

async function main() {
  console.log(`\n=== Mailjet Automation: ${new Date().toISOString()} ===\n`);

  if (!IS_PROD && !DRY_RUN && !SANDBOX_EMAIL) {
    console.error('SAFETY: Running outside production without --dry-run or SANDBOX_EMAIL.');
    console.error('Set DRY_RUN=true, SANDBOX_EMAIL=test@example.com, or NODE_ENV=production to proceed.');
    process.exit(1);
  }

  if (DRY_RUN) console.log('  🔸 DRY RUN mode — no emails will be sent\n');
  if (SANDBOX_EMAIL) console.log(`  🔸 SANDBOX mode — all emails redirected to ${SANDBOX_EMAIL}\n`);

  const cosmos = getCosmosClient();
  const db = cosmos.database(COSMOS_DATABASE);
  const container = db.container(COSMOS_CONTAINER);

  console.log('Fetching all enrollments from Cosmos DB...');
  const enrollments = await listEnrollments(container);
  console.log(`Found ${enrollments.length} enrollments.\n`);

  const stats = { errors: 0 };

  const modeArg = process.argv.find(a => !a.startsWith('--')) || 'all';
  const mode = modeArg === process.argv[0] ? 'all' : modeArg;

  if (mode === 'all' || mode === 'welcome') {
    console.log('[Welcome Emails]');
    const n = await sendWelcomeEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'offer-letter') {
    console.log('[Offer Letter Emails]');
    const n = await sendOfferLetterEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'payment') {
    console.log('[Payment Confirmation Emails]');
    const n = await sendPaymentConfirmationEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'task-reminder') {
    console.log('[Task Reminder Emails (every 4 days)]');
    const n = await sendTaskReminderEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'pre-expiry') {
    console.log('[Pre-Expiry Emails (5 days before end)]');
    const n = await sendPreExpiryEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'completion') {
    console.log('[Completion Certificate Emails]');
    const n = await sendCompletionEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  console.log(`=== Done. Errors: ${stats.errors} ===`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { sendEmail } from '../lib/mailjet.js';
import {
  welcomeEmail, offerLetterEmail, paymentConfirmationEmail,
  taskReminderEmail, preExpiryEmail, completionCertificateEmail,
} from '../lib/email-templates.js';
import {
  fbGet, fbPut, fbPatch, fbPush, logEmailSend, hasEmailBeenSent,
  getEmailLogs, analyzeAndStoreEnrollments, getEnrollmentCategories,
} from '../lib/firebase.js';
import {
  analyzeEnrollmentsForEmailing, deduplicateEnrollments, suggestEmailContent, analyzeLogs,
} from '../lib/ai-analyzer.js';

const COSMOS_DATABASE = 'devcraft';
const COSMOS_CONTAINER = 'main';
const FROM_EMAIL = 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || null;
const IS_PROD = process.env.NODE_ENV === 'production';

const BLOCKED_EMAILS = new Set([
  'vibhuteonkar588@gmail.com',
  'harshadyadav2122005@gmail.com',
  'atharvajangam159@gmail.com',
  ...(process.env.BLOCKED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
]);

function isBlocked(email) {
  return BLOCKED_EMAILS.has((email || '').toLowerCase().trim());
}

function resolveEmail(original) {
  if (DRY_RUN) return null;
  if (isBlocked(original)) { console.log(`  ⊘ Blocked: ${original}`); return null; }
  if (SANDBOX_EMAIL) return SANDBOX_EMAIL;
  return original;
}

function logSend(label, enrollment, details = '') {
  const to = enrollment?.email || '';
  if (DRY_RUN) { console.log(`  ◇ ${label}: ${to} ${details}`.trim()); return; }
  if (SANDBOX_EMAIL) { console.log(`  ✓ ${label}: ${to} → ${SANDBOX_EMAIL} ${details}`.trim()); return; }
  console.log(`  ✓ ${label}: ${to} ${details}`.trim());
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

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function getTaskStats(projects, submissions) {
  let totalTasks = 0, completedTasks = 0, pendingTasks = 0, lastSubmittedAt = null;
  for (let i = 0; i < (projects || []).length; i++) {
    totalTasks++;
    const sub = (submissions || {})[i];
    if (sub?.verified) { completedTasks++; }
    else { pendingTasks++; if (sub?.submittedAt && (!lastSubmittedAt || sub.submittedAt > lastSubmittedAt)) lastSubmittedAt = sub.submittedAt; }
  }
  return { totalTasks, completedTasks, pendingTasks, lastSubmittedAt };
}

async function shouldSendEmail(email, type) {
  if (SANDBOX_EMAIL || DRY_RUN) return true;
  return !(await hasEmailBeenSent({ email, type }));
}

async function sendWithTracking({ enrollment, type, subject, html, container, flag }) {
  const to = resolveEmail(enrollment.email);
  if (!to) { logSend(type, enrollment, '(dry-run)'); return true; }
  try {
    const result = await sendEmail({ to, toName: enrollment.name, subject, html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
    const messageId = result?.Messages?.[0]?.To?.[0]?.MessageID || result?.Messages?.[0]?.MessageID || '';
    if (!SANDBOX_EMAIL) {
      if (flag) await updateEnrollment(container, enrollment.id, { [flag]: true, [flag.replace('Sent', 'SentAt')]: new Date().toISOString() });
    }
    await logEmailSend({ email: enrollment.email, name: enrollment.name, internId: enrollment.internId, type, subject, status: 'sent', messageId });
    logSend(type, enrollment);
    return true;
  } catch (err) {
    console.error(`  ✗ ${type} failed for ${enrollment.email}: ${err.message}`);
    await logEmailSend({ email: enrollment.email, name: enrollment.name, internId: enrollment.internId, type, subject, status: 'failed', error: err.message });
    return false;
  }
}

async function sendWelcomeEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.welcomeSent) continue;
    if (!(await shouldSendEmail(e.email, 'welcome'))) { console.log(`  Skipped ${e.email}: already sent via Firebase`); continue; }
    const tpl = welcomeEmail({ name: e.name || 'Intern', email: e.email });
    const ok = await sendWithTracking({ enrollment: e, type: 'welcome', subject: tpl.subject, html: tpl.html, container, flag: 'mailjet.welcomeSent' });
    if (ok) sent++;
    else stats.errors++;
  }
  return sent;
}

async function sendOfferLetterEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.offerLetterSent) continue;
    if (!e.internId || !e.domain) continue;
    if (!(await shouldSendEmail(e.email, 'offerLetter'))) continue;
    const tpl = offerLetterEmail({ name: e.name || 'Intern', email: e.email, internId: e.internId, domain: e.domain });
    const ok = await sendWithTracking({ enrollment: e, type: 'offerLetter', subject: tpl.subject, html: tpl.html, container, flag: 'mailjet.offerLetterSent' });
    if (ok) sent++;
    else stats.errors++;
  }
  return sent;
}

async function sendPaymentConfirmationEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.paymentSent) continue;
    if (e.paymentStatus !== 'completed') continue;
    if (!e.internId) continue;
    if (!(await shouldSendEmail(e.email, 'payment'))) continue;
    const tpl = paymentConfirmationEmail({ name: e.name || 'Intern', email: e.email, amount: e.paymentAmount, paymentId: e.paymentId, internId: e.internId, domain: e.domain });
    const ok = await sendWithTracking({ enrollment: e, type: 'payment', subject: tpl.subject, html: tpl.html, container, flag: 'mailjet.paymentSent' });
    if (ok) sent++;
    else stats.errors++;
  }
  return sent;
}

async function sendTaskReminderEmails(container, enrollments, stats) {
  let sent = 0;
  const today = todayStr();
  for (const e of enrollments) {
    if (!e.internId) continue;
    const { pendingTasks, lastSubmittedAt } = getTaskStats(e.projects || [], e.submissions || {});
    if (pendingTasks === 0) continue;
    const lastReminderSentAt = e.mailjet?.lastTaskReminderSentAt;
    const daysSinceLastReminder = lastReminderSentAt ? daysBetween(lastReminderSentAt, today) : Infinity;
    if (daysSinceLastReminder < 4) continue;
    if (!(await shouldSendEmail(e.email, 'taskReminder'))) continue;
    const daysSinceActivity = lastSubmittedAt ? daysBetween(lastSubmittedAt, today) : null;
    const tpl = taskReminderEmail({ name: e.name || 'Intern', email: e.email, pendingTasks, daysSinceLastActivity: daysSinceActivity, internId: e.internId });
    const ok = await sendWithTracking({ enrollment: e, type: 'taskReminder', subject: tpl.subject, html: tpl.html, container, flag: 'mailjet.lastTaskReminderSentAt' });
    if (ok) sent++;
    else stats.errors++;
  }
  return sent;
}

async function sendPreExpiryEmails(container, enrollments, stats) {
  let sent = 0;
  const today = todayStr();
  for (const e of enrollments) {
    if (!e.internId) continue;
    const endDate = e.endDate || e.internshipEndDate;
    if (!endDate) continue;
    const daysUntilEnd = daysBetween(today, endDate);
    if (daysUntilEnd !== 5) continue;
    if (e.mailjet?.preExpirySent) continue;
    const { pendingTasks } = getTaskStats(e.projects || [], e.submissions || {});
    if (pendingTasks === 0) continue;
    if (!(await shouldSendEmail(e.email, 'preExpiry'))) continue;
    const tpl = preExpiryEmail({ name: e.name || 'Intern', email: e.email, internId: e.internId, domain: e.domain || 'N/A', endDate, remainingTasks: pendingTasks });
    const ok = await sendWithTracking({ enrollment: e, type: 'preExpiry', subject: tpl.subject, html: tpl.html, container, flag: 'mailjet.preExpirySent' });
    if (ok) sent++;
    else stats.errors++;
  }
  return sent;
}

async function sendCompletionEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    if (e.mailjet?.completionSent) continue;
    if (!e.internId) continue;
    const { totalTasks, completedTasks } = getTaskStats(e.projects || [], e.submissions || {});
    if (totalTasks === 0 || completedTasks < totalTasks) continue;
    if (!(await shouldSendEmail(e.email, 'completion'))) continue;
    const tpl = completionCertificateEmail({ name: e.name || 'Intern', email: e.email, internId: e.internId, domain: e.domain || 'N/A' });
    const ok = await sendWithTracking({ enrollment: e, type: 'completion', subject: tpl.subject, html: tpl.html, container, flag: 'mailjet.completionSent' });
    if (ok) sent++;
    else stats.errors++;
  }
  return sent;
}

async function main() {
  console.log(`\n=== Mailjet Automation: ${new Date().toISOString()} ===\n`);

  if (!IS_PROD && !DRY_RUN && !SANDBOX_EMAIL) {
    console.error('SAFETY: Use --dry-run, SANDBOX_EMAIL, or NODE_ENV=production');
    process.exit(1);
  }
  if (DRY_RUN) console.log('  🔸 DRY RUN — no emails sent\n');
  if (SANDBOX_EMAIL) console.log(`  🔸 SANDBOX → ${SANDBOX_EMAIL}\n`);

  const cosmos = getCosmosClient();
  const db = cosmos.database(COSMOS_DATABASE);
  const container = db.container(COSMOS_CONTAINER);

  console.log('Fetching enrollments from Cosmos DB...');
  const rawEnrollments = await listEnrollments(container);
  console.log(`Found ${rawEnrollments.length} raw records.\n`);

  const { unique: enrollments, duplicates } = await deduplicateEnrollments(rawEnrollments);
  if (duplicates.length > 0) {
    console.log(`Dedup removed ${duplicates.length} duplicate entries:`);
    for (const d of duplicates) console.log(`  Removed ${d.duplicate} (kept ${d.kept}) — ${d.email}`);
    await fbPut('mailjet/dedup/latest', { duplicates, count: duplicates.length, cleanedAt: new Date().toISOString() });
    console.log();
  }

  const modeArg = process.argv.find(a => !a.startsWith('--')) || 'all';
  const mode = modeArg === process.argv[0] ? 'all' : modeArg;
  const stats = { errors: 0 };

  if (mode === 'all' || mode === 'analyze') {
    console.log('[AI Analysis]');
    console.log('  Analyzing enrollment data with AI...');
    const aiResult = await analyzeEnrollmentsForEmailing(enrollments);
    if (aiResult) {
      await fbPut('mailjet/ai-analysis/latest', aiResult);
      console.log(`  AI identified: ${aiResult.needsWelcome?.length || 0} welcome, ${aiResult.needsOfferLetter?.length || 0} offer letters, ${aiResult.needsPaymentConfirm?.length || 0} payments, ${aiResult.needsTaskReminder?.length || 0} reminders, ${aiResult.needsPreExpiry?.length || 0} pre-expiry, ${aiResult.needsCompletion?.length || 0} completions`);
      if (aiResult.duplicates?.length) console.log(`  AI flagged ${aiResult.duplicates.length} duplicates`);
    } else {
      console.log('  AI analysis unavailable, using rule-based analysis');
    }
    const summary = await analyzeAndStoreEnrollments(enrollments);
    const categories = await getEnrollmentCategories(enrollments);
    console.log(`  Stored: ${summary.total} enrollments, ${categories.active.length} active, ${categories.completed.length} completed\n`);
  }

  if (mode === 'all' || mode === 'welcome') {
    console.log('[Welcome Emails — 1-time only]');
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
    console.log('[Task Reminder Emails — combined, every 4 days max]');
    const n = await sendTaskReminderEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'pre-expiry') {
    console.log('[Pre-Expiry Emails — 5 days before end]');
    const n = await sendPreExpiryEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'completion') {
    console.log('[Completion Certificate Emails]');
    const n = await sendCompletionEmails(container, enrollments, stats);
    console.log(`  → ${n} sent\n`);
  }

  if (mode === 'all' || mode === 'logs') {
    console.log('[Email Logs]');
    const logs = await getEmailLogs(null, 100);
    console.log(`  Total logs in Firebase: ${logs.length}`);
    const byType = {};
    for (const l of logs) { byType[l.type] = (byType[l.type] || 0) + 1; }
    for (const [t, c] of Object.entries(byType)) console.log(`  ${t}: ${c}`);
    const aiLogs = await analyzeLogs(logs);
    if (aiLogs) await fbPut('mailjet/ai-analysis/logs', aiLogs);
    console.log();
  }

  console.log(`=== Done. Errors: ${stats.errors} ===`);
}

main().catch((err) => { console.error('[FATAL]', err); process.exit(1); });

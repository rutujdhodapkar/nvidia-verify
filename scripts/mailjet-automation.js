import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { sendEmail } from '../lib/mailjet.js';
import {
  fbGet, fbPut, fbPatch, fbPush, logEmailSend, hasEmailBeenSent,
  getEmailLogs, analyzeAndStoreEnrollments, getEnrollmentCategories,
} from '../lib/firebase.js';
import {
  analyzeEnrollmentsForEmailing, deduplicateEnrollments, suggestEmailContent, analyzeLogs,
} from '../lib/ai-analyzer.js';
import { isBlocked } from '../lib/blocklist.js';

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
  const to = enrollment?.email || '';
  if (isBlocked(to)) { console.log(`  \u2299 ${label}: ${to} blocked`); return; }
  if (DRY_RUN) { console.log(`  \u25c7 ${label}: ${to} ${details}`.trim()); return; }
  if (SANDBOX_EMAIL) { console.log(`  \u2713 ${label}: ${to} \u2192 ${SANDBOX_EMAIL} ${details}`.trim()); return; }
  console.log(`  \u2713 ${label}: ${to} ${details}`.trim());
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

function determinePendingEmailTypes(enrollment) {
  const types = [];
  const today = todayStr();
  const { pendingTasks, totalTasks, completedTasks } = getTaskStats(enrollment.projects || [], enrollment.submissions || {});
  const endDate = enrollment.endDate || enrollment.internshipEndDate;

  if (!enrollment.mailjet?.welcomeSent) types.push('welcome');
  if (enrollment.internId && enrollment.domain && !enrollment.mailjet?.offerLetterSent) types.push('offerLetter');
  if (enrollment.paymentStatus === 'completed' && enrollment.internId && !enrollment.mailjet?.paymentSent) types.push('payment');
  if (enrollment.internId && pendingTasks > 0) {
    const lastReminderSentAt = enrollment.mailjet?.lastTaskReminderSentAt;
    const daysSinceLastReminder = lastReminderSentAt ? daysBetween(lastReminderSentAt, today) : Infinity;
    if (daysSinceLastReminder >= 4) types.push('taskReminder');
  }
  if (enrollment.internId && endDate) {
    const daysUntilEnd = daysBetween(today, endDate);
    if (daysUntilEnd === 5 && pendingTasks > 0 && !enrollment.mailjet?.preExpirySent) types.push('preExpiry');
  }
  if (enrollment.internId && totalTasks > 0 && completedTasks >= totalTasks && !enrollment.mailjet?.completionSent) types.push('completion');

  return types;
}

function buildCombinedBody(enrollment, types) {
  const { name, email, internId, domain, paymentAmount, paymentId } = enrollment;
  const endDate = enrollment.endDate || enrollment.internshipEndDate;
  const { pendingTasks, totalTasks, completedTasks } = getTaskStats(enrollment.projects || [], enrollment.submissions || {});
  const today = todayStr();
  const daysUntilEnd = endDate ? daysBetween(today, endDate) : null;
  const lastSubmittedAt = getTaskStats(enrollment.projects || [], enrollment.submissions || {}).lastSubmittedAt;
  const daysSinceActivity = lastSubmittedAt ? daysBetween(lastSubmittedAt, today) : null;

  const sections = {
    welcome: types.includes('welcome') ? `<h2>Welcome to DEV/CRAFT!</h2><p>Hi ${name},</p><p>Welcome to the DEV/CRAFT internship program! We're excited to have you on board.</p><p>You'll receive further instructions about your domain and tasks shortly.</p>` : '',
    offerLetter: types.includes('offerLetter') ? `<h2>Offer Letter & Internship Details</h2><p>Congratulations ${name}!</p><p>Your internship offer has been confirmed.</p><ul><li><strong>Intern ID:</strong> ${internId}</li><li><strong>Domain:</strong> ${domain}</li></ul><p>Please keep your Intern ID handy for all future correspondence.</p>` : '',
    payment: types.includes('payment') ? `<h2>Payment Confirmation</h2><p>Hi ${name},</p><p>Your payment of <strong>${paymentAmount || 'N/A'}</strong> has been received successfully.</p>${paymentId ? `<p>Payment ID: ${paymentId}</p>` : ''}<p>Your internship is now active. Get started with your tasks!</p>` : '',
    taskReminder: types.includes('taskReminder') ? `<h2>Task Reminder</h2><p>Hi ${name},</p><p>You have <strong>${pendingTasks}</strong> pending task${pendingTasks > 1 ? 's' : ''} in your internship.</p>${daysSinceActivity !== null ? `<p>Last activity was ${daysSinceActivity} day${daysSinceActivity !== 1 ? 's' : ''} ago.</p>` : '<p>Please start working on your tasks as soon as possible.</p>'}<p>Stay on track to complete your internship successfully!</p>` : '',
    preExpiry: types.includes('preExpiry') ? `<h2>Internship Ending Soon</h2><p>Hi ${name},</p><p>Your internship is ending in <strong>${daysUntilEnd} days</strong> (${endDate}).</p><p>You still have <strong>${pendingTasks}</strong> pending task${pendingTasks > 1 ? 's' : ''}. Please complete them before the deadline.</p><p>If you need an extension, please reach out to us.</p>` : '',
    completion: types.includes('completion') ? `<h2>Congratulations! Internship Complete</h2><p>Hi ${name},</p><p>You have successfully completed all ${totalTasks} task${totalTasks !== 1 ? 's' : ''} of your DEV/CRAFT internship!</p><p>Your completion certificate will be issued shortly.</p><p>Thank you for your hard work and dedication.</p>` : '',
  };

  const bodySections = Object.values(sections).filter(Boolean);
  if (bodySections.length === 0) return null;

  const subjectPrefix = types.includes('completion') ? 'Congratulations! ' : types.includes('preExpiry') ? 'Urgent: ' : '';
  const subject = `${subjectPrefix}DEV/CRAFT Internship Update`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f4f4f4">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
<div style="background:#2563eb;padding:20px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">DEV/CRAFT Internship</h1>
</div>
<div style="padding:24px">
${bodySections.join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">')}
</div>
<div style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:12px;color:#6b7280">
<p style="margin:4px 0">DEV/CRAFT Internship Program</p>
<p style="margin:4px 0">Email: support@fennark.xyz</p>
</div>
</div>
</body>
</html>`;

  return { subject, html };
}

async function sendCombinedEmails(container, enrollments, stats) {
  let sent = 0;
  for (const e of enrollments) {
    try {
      const types = determinePendingEmailTypes(e);
      if (types.length === 0) continue;

      if (isBlocked(e.email)) { logSend('combined', e, `[${types.join(', ')}] blocked`); continue; }

      const to = resolveEmail(e.email);
      if (!to) { logSend('combined', e, `[${types.join(', ')}] (dry-run)`); continue; }

      const emailContent = buildCombinedBody(e, types);
      if (!emailContent) continue;

      const flags = {};
      const now = new Date().toISOString();
      for (const t of types) {
        const flagMap = {
          welcome: 'mailjet.welcomeSent',
          offerLetter: 'mailjet.offerLetterSent',
          payment: 'mailjet.paymentSent',
          taskReminder: 'mailjet.lastTaskReminderSentAt',
          preExpiry: 'mailjet.preExpirySent',
          completion: 'mailjet.completionSent',
        };
        const flag = flagMap[t];
        if (flag.endsWith('SentAt')) flags[flag] = now;
        else flags[flag] = true;
        if (flag.endsWith('Sent')) flags[flag.replace('Sent', 'SentAt')] = now;
      }

      const result = await sendEmail({ to, toName: e.name, subject: emailContent.subject, html: emailContent.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME });
      const messageId = result?.Messages?.[0]?.To?.[0]?.MessageID || result?.Messages?.[0]?.MessageID || '';

      if (!SANDBOX_EMAIL) {
        if (Object.keys(flags).length > 0) await updateEnrollment(container, e.id, flags);
      }

      for (const t of types) {
        await logEmailSend({ email: e.email, name: e.name, internId: e.internId, type: t, subject: emailContent.subject, status: 'sent', messageId });
      }
      logSend('combined', e, `[${types.join(', ')}]`);
      sent++;
    } catch (err) {
      console.error(`  \u2717 combined failed for ${e.email}: ${err.message}`);
      await logEmailSend({ email: e.email, name: e.name, internId: e.internId, type: 'combined', subject: 'DEV/CRAFT Internship Update', status: 'failed', error: err.message });
      stats.errors++;
    }
  }
  return sent;
}

async function main() {
  console.log(`\n=== Mailjet Automation: ${new Date().toISOString()} ===\n`);

  if (!IS_PROD && !DRY_RUN && !SANDBOX_EMAIL) {
    console.error('SAFETY: Use --dry-run, SANDBOX_EMAIL, or NODE_ENV=production');
    process.exit(1);
  }
  if (DRY_RUN) console.log('  \u{1F7E1} DRY RUN \u2014 no emails sent\n');
  if (SANDBOX_EMAIL) console.log(`  \u{1F7E1} SANDBOX \u2192 ${SANDBOX_EMAIL}\n`);

  const cosmos = getCosmosClient();
  const db = cosmos.database(COSMOS_DATABASE);
  const container = db.container(COSMOS_CONTAINER);

  console.log('Fetching enrollments from Cosmos DB...');
  const rawEnrollments = await listEnrollments(container);
  console.log(`Found ${rawEnrollments.length} raw records.\n`);

  const { unique: enrollments, duplicates } = await deduplicateEnrollments(rawEnrollments);
  if (duplicates.length > 0) {
    console.log(`Dedup removed ${duplicates.length} duplicate entries:`);
    for (const d of duplicates) console.log(`  Removed ${d.duplicate} (kept ${d.kept}) \u2014 ${d.email}`);
    await fbPut('mailjet/dedup/latest', { duplicates, count: duplicates.length, cleanedAt: new Date().toISOString() });
    console.log();
  }

  const modeArg = process.argv.find(a => !a.startsWith('--')) || 'all';
  const mode = modeArg === process.argv[0] ? 'all' : modeArg;
  const stats = { errors: 0 };

  if (mode === 'all' || mode === 'analyze') {
    console.log('[Analysis & Categorization]');
    const summary = await analyzeAndStoreEnrollments(enrollments);
    const categories = await getEnrollmentCategories(enrollments);
    console.log(`  ${summary.total} enrollments, ${categories.active.length} active, ${categories.completed.length} completed, ${categories.new_signups.length} new, ${categories.near_completion.length} near-end, ${categories.expired.length} expired`);
    console.log();
  }

  if (mode === 'all' || mode === 'combined') {
    console.log('[Combined Emails \u2014 one per user with all applicable sections]');
    const n = await sendCombinedEmails(container, enrollments, stats);
    console.log(`  \u2192 ${n} sent\n`);
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

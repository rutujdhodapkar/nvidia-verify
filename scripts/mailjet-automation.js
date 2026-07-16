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

function encodeKey(str) {
  return (str || '').toLowerCase().replace(/[.#$\/\[\]]/g, '_');
}

async function getUserState(email) {
  const data = await fbGet(`mailjet/user-state/${encodeKey(email)}`);
  return data || {};
}

async function updateUserState(email, updates) {
  await fbPatch(`mailjet/user-state/${encodeKey(email)}`, updates);
}

function determineCategory(enrollment, state) {
  const { totalTasks, completedTasks } = getTaskStats(enrollment.projects || [], enrollment.submissions || {});
  const allDone = totalTasks > 0 && completedTasks >= totalTasks;
  if (allDone) return 'completed';
  if (state?.category === 'completed') return 're-enrolled';
  return 'active';
}

function shouldSendCombined(enrollment, state) {
  const today = todayStr();
  const lastSent = state?.lastCombinedSentAt;
  if (!lastSent) return true;
  return daysBetween(lastSent, today) >= 5;
}

function buildCombinedBody(enrollment, category) {
  const { name, email, internId, domain, paymentAmount, projects, submissions } = enrollment;
  const endDate = enrollment.endDate || enrollment.internshipEndDate;
  const { totalTasks, completedTasks, pendingTasks } = getTaskStats(projects || [], submissions || {});
  const today = todayStr();
  const daysUntilEnd = endDate ? daysBetween(today, endDate) : null;
  const now = new Date().toISOString();

  let subject, greeting, sections = [];

  if (category === 'completed') {
    subject = 'Your DEV/CRAFT Journey – What\'s Next?';
    greeting = `<h2>Congratulations, ${name || 'Intern'}!</h2>`;
    sections = [
      `<p>You've successfully completed all ${totalTasks} task${totalTasks !== 1 ? 's' : ''} of your DEV/CRAFT internship. Great work!</p>`,
      `<p>Your certificate of completion is available. Stay tuned for updates on new opportunities, advanced programs, and referral rewards.</p>`,
      `<p style="color:#6b7280;font-size:13px">If you'd like to explore a new internship with us, simply re-apply and we'll fast-track your enrollment.</p>`,
    ];
  } else {
    const prefix = category === 're-enrolled' ? 'Welcome Back' : 'DEV/CRAFT Update';
    subject = `${prefix} – Your Internship Progress`;
    greeting = `<h2>Hi ${name || 'Intern'}${category === 're-enrolled' ? ', welcome back!' : '!'}</h2>`;

    if (category === 're-enrolled') {
      sections.push(`<p>We're glad to see you again! Your new internship is now active.</p>`);
    } else if (internId && !enrollment.mailjet?.welcomeSent) {
      sections.push(`<p>Welcome to the DEV/CRAFT internship program! We're excited to have you on board.</p>`);
    }

    if (internId && domain) {
      sections.push(`<h3>Your Internship Details</h3><ul><li><strong>Intern ID:</strong> ${internId}</li><li><strong>Domain:</strong> ${domain}</li></ul>`);
    }

    if (pendingTasks > 0) {
      sections.push(`<h3>Task Progress</h3><p>You have <strong>${pendingTasks}</strong> pending task${pendingTasks > 1 ? 's' : ''} out of ${totalTasks} total.</p>`);
      if (completedTasks > 0) sections.push(`<p>Completed: ${completedTasks} / ${totalTasks}</p>`);
      if (daysUntilEnd !== null && daysUntilEnd > 0) {
        sections.push(`<p><strong>Deadline:</strong> ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} remaining (${endDate}).</p>`);
      }
    } else if (totalTasks > 0) {
      sections.push(`<h3>Task Progress</h3><p>You've completed all ${totalTasks} task${totalTasks !== 1 ? 's' : ''}! Your final review is in progress.</p>`);
    }

    if (enrollment.paymentStatus === 'completed' && paymentAmount) {
      sections.push(`<p>Payment received: <strong>${paymentAmount}</strong></p>`);
    }

    sections.push(`<p style="color:#6b7280;font-size:13px">Check your dashboard for detailed task status and submissions.</p>`);
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0;background:#f4f4f4">
<div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
<div style="background:#2563eb;padding:20px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">DEV/CRAFT Internship</h1>
</div>
<div style="padding:24px">
${greeting}
${sections.join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">')}
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
  let sent = 0, skipped = 0, blocked = 0;
  for (const e of enrollments) {
    try {
      if (!e.email) continue;
      if (isBlocked(e.email)) { logSend('combined', e, 'blocked'); blocked++; continue; }

      const state = await getUserState(e.email);
      const category = determineCategory(e, state);

      if (!shouldSendCombined(e, state)) {
        const lastSent = state?.lastCombinedSentAt?.slice(0, 10);
        logSend('skipped', e, `last sent ${lastSent}, < 5 days`);
        skipped++;
        continue;
      }

      const to = resolveEmail(e.email);
      if (!to) { logSend('combined', e, `[${category}] (dry-run)`); sent++; continue; }

      const emailContent = buildCombinedBody(e, category);
      if (!emailContent) { skipped++; continue; }

      const headers = category === 'completed'
        ? [{ Name: 'Precedence', Value: 'bulk' }, { Name: 'X-Category', Value: 'promo' }]
        : [];
      if (category === 're-enrolled') {
        headers.push({ Name: 'X-Category', Value: 're-enrolled' });
      }

      const now = new Date().toISOString();
      const result = await sendEmail({ to, toName: e.name, subject: emailContent.subject, html: emailContent.html, fromEmail: FROM_EMAIL, fromName: FROM_NAME, headers });
      const messageId = result?.Messages?.[0]?.To?.[0]?.MessageID || result?.Messages?.[0]?.MessageID || '';

      await updateUserState(e.email, { category, lastCombinedSentAt: now });
      await logEmailSend({ email: e.email, name: e.name, internId: e.internId, type: `combined_${category}`, subject: emailContent.subject, status: 'sent', messageId });

      logSend('combined', e, `[${category}]`);
      sent++;
    } catch (err) {
      console.error(`  \u2717 combined failed for ${e.email}: ${err.message}`);
      await logEmailSend({ email: e.email, name: e.name, internId: e.internId, type: 'combined', subject: 'DEV/CRAFT Internship Update', status: 'failed', error: err.message });
      stats.errors++;
    }
  }
  return { sent, skipped, blocked };
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
    console.log('[Combined Emails \u2014 one per user every 5 days]');
    const result = await sendCombinedEmails(container, enrollments, stats);
    console.log(`  \u2192 ${result.sent} sent, ${result.skipped} skipped (< 5 days), ${result.blocked} blocked\n`);
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

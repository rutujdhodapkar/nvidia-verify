import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';
import { sendEmail } from '../lib/email-provider.js';
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

  let subject, parts = [];

  if (category === 'completed') {
    subject = 'Your DEV/CRAFT Journey – What\'s Next?';
    parts = [
      `Congratulations, ${name || 'Intern'}!`,
      '',
      `You've successfully completed all ${totalTasks} task${totalTasks !== 1 ? 's' : ''} of your DEV/CRAFT internship. Great work!`,
      '',
      'Your certificate of completion is available. Stay tuned for updates on new opportunities, advanced programs, and referral rewards.',
      '',
      'If you'd like to explore a new internship with us, simply re-apply and we\'ll fast-track your enrollment.',
    ];
  } else {
    const prefix = category === 're-enrolled' ? 'Welcome Back' : 'DEV/CRAFT Update';
    subject = `${prefix} – Your Internship Progress`;
    parts.push(`Hi ${name || 'Intern'}${category === 're-enrolled' ? ', welcome back!' : '!'}`);

    if (category === 're-enrolled') {
      parts.push('', "We're glad to see you again! Your new internship is now active.");
    } else if (internId && !enrollment.mailjet?.welcomeSent) {
      parts.push('', "Welcome to the DEV/CRAFT internship program! We're excited to have you on board.");
    }

    if (internId && domain) {
      parts.push('', `Intern ID: ${internId}`, `Domain: ${domain}`);
    }

    if (pendingTasks > 0) {
      parts.push('', `You have ${pendingTasks} pending task${pendingTasks > 1 ? 's' : ''} out of ${totalTasks} total.`);
      if (completedTasks > 0) parts.push(`Completed: ${completedTasks} / ${totalTasks}`);
      if (daysUntilEnd !== null && daysUntilEnd > 0) {
        parts.push(`Deadline: ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} remaining (${endDate}).`);
      }
    } else if (totalTasks > 0) {
      parts.push('', `You've completed all ${totalTasks} task${totalTasks !== 1 ? 's' : ''}! Your final review is in progress.`);
    }

    if (enrollment.paymentStatus === 'completed' && paymentAmount) {
      parts.push('', `Payment received: ${paymentAmount}`);
    }

    parts.push('', 'Check your dashboard for detailed task status and submissions.');
  }

  parts.push('', '---', 'DEV/CRAFT Internship Program', 'support@fennark.xyz');

  const text = parts.join('\n');
  return { subject, text };
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
      const result = await sendEmail({ to, toName: e.name, subject: emailContent.subject, text: emailContent.text, headers });
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

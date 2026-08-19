import 'dotenv/config';
import { sendEmail, getProviderStatus } from '../lib/email-provider.js';
import { isBlocked, BLOCKED_EMAILS } from '../lib/blocklist.js';
import {
  pfGet, pfPut, pfPatch, pfDelete, encodeKey, removeBlockedEmails,
} from '../lib/portfolio-firebase.js';
import { logEmailSend } from '../lib/firebase.js';

const SITE = 'devcraft.fennark.xyz';
const HOLD_DAYS = 5;
const DAILY_CAP = 300;
const SEND_DELAY_MS = 2000;

const DRY_RUN = process.argv.includes('--dry-run');

const WEB_CATEGORY_ORDER = [
  'welcome',
  'login',
  'internship_application',
  'payment_success',
  'task_completed',
  'all_tasks_done_no_payment',
  'internship_expired',
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

const templates = {
  welcome: {
    subject: 'Welcome to DEV/CRAFT! Start Your Internship Journey',
    body: (name) => `Hi ${name || 'there'},

Thanks for signing up! You're now part of the DEV/CRAFT community.

Next step: Complete your profile and select your internship domain to receive your offer letter with a unique Intern ID.

Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.

Get started: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  login: {
    subject: 'Continue Your DEV/CRAFT Internship',
    body: (name) => `Hi ${name || 'there'},

We noticed you've logged in but haven't completed your enrollment yet.

Select your domain to receive your instant offer letter and start working on real projects. It takes just 2 minutes.

Choose your domain: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  internship_application: {
    subject: 'Your DEV/CRAFT Application — Next Steps',
    body: (name) => `Hi ${name || 'there'},

Your internship application has been received! Here's what happens next:

- Complete your payment to activate your internship
- Receive your offer letter with a unique Intern ID
- Start working on 6 weeks of real projects
- Earn your completion certificate with live verification

Complete enrollment: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  payment_success: {
    subject: 'Payment Confirmed — Your Internship is Active',
    body: (name) => `Hi ${name || 'there'},

Your payment has been confirmed. Your internship is now fully active!

You can start working on your projects immediately. Complete all tasks to earn your certificate.

Go to dashboard: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  task_completed: {
    subject: 'Task Completed — Keep Going',
    body: (name) => `Hi ${name || 'there'},

Good progress! A task in your DEV/CRAFT internship has been verified and marked complete.

Keep the momentum going — check your dashboard to see what's next and stay on track to finish all your projects.

View dashboard: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  all_done_with_payment: {
    subject: 'Congratulations! Your Internship is Complete',
    body: (name) => `Hi ${name || 'there'},

Congratulations on completing your DEV/CRAFT internship! Your certificate is ready with a live verification link.

Share your achievement on LinkedIn and tag DEV/CRAFT. Stay tuned for advanced programs and referral rewards.

View certificate: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  all_tasks_done_no_payment: {
    subject: 'Complete Your Payment to Get Certified',
    body: (name) => `Hi ${name || 'there'},

You've completed all your tasks — great work! Just one more step: complete your payment to unlock your certificate.

Complete payment: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  internship_expired: {
    subject: 'Your Internship Has Expired — Re-apply Now',
    body: (name) => `Hi ${name || 'there'},

Your previous internship period has ended. But don't worry — you can re-apply and continue from where you left off.

Re-apply now: https://${SITE}

Best,
The DEV/CRAFT Team`,
  },
  promo: [
    {
      subject: 'A virtual internship you can start this week',
      body: (name) => `Hi ${name || 'there'},

DEV/CRAFT is accepting applications for virtual internships across 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.

When you apply and enroll, you get an offer letter right away, then spend 6 weeks building real projects that go straight into your portfolio.

It takes about 2 minutes to apply. No interviews, no waiting.

Apply here: https://${SITE}

If you're not interested, just reply "unsubscribe" and we won't write again.

Best,
The DEV/CRAFT Team`,
    },
    {
      subject: 'Your offer letter can be ready today',
      body: (name) => `Hi ${name || 'there'},

At DEV/CRAFT the offer letter arrives the moment you enroll. No screening rounds, no waiting for approvals.

Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, Data Analytics, and more. Each program is 6 weeks, self-paced, and built around projects that teach real skills.

Your certificate comes with a live verification link employers can check in seconds.

Enroll here: https://${SITE}

If you're not interested, just reply "unsubscribe" and we won't write again.

Best,
The DEV/CRAFT Team`,
    },
    {
      subject: 'Real projects for your portfolio',
      body: (name) => `Hi ${name || 'there'},

A DEV/CRAFT virtual internship is a straightforward way to get real, portfolio-ready work on your resume.

Complete 6 weeks of projects in your chosen domain and earn a certificate with live verification. Self-paced, no experience required.

20+ domains to choose from:

See the programs here: https://${SITE}

If you're not interested, just reply "unsubscribe" and we won't write again.

Best,
The DEV/CRAFT Team`,
    },
  ],
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

function categoryPriority(cat) {
  const idx = WEB_CATEGORY_ORDER.indexOf(cat);
  return idx === -1 ? WEB_CATEGORY_ORDER.length : idx;
}

function primaryCategory(entry) {
  return entry.categories
    .filter(c => c !== 'promo')
    .sort((a, b) => categoryPriority(a) - categoryPriority(b))[0];
}

function pickTemplate(category, counter = 0) {
  const tpl = templates[category];
  if (!tpl) return templates.promo[counter % templates.promo.length];
  if (Array.isArray(tpl)) return tpl[counter % tpl.length];
  return tpl;
}

async function getMeta() {
  const data = await pfGet('meta');
  return data || {};
}

async function saveMeta(meta) {
  // PATCH only the fields this script owns so it never overwrites the
  // provider usage counters (usageDate/brevoCount/mailjetCount) that
  // email-provider.js writes into the same meta node.
  await pfPatch('meta', { templateCounter: meta.templateCounter, lastRunDate: meta.lastRunDate });
}

async function getAllWebEmails() {
  const cats = await pfGet('emailCategories');
  if (!cats || typeof cats !== 'object') return [];
  const emails = [];
  let skipped = 0;
  for (const [category, entries] of Object.entries(cats)) {
    if (!entries || typeof entries !== 'object') continue;
    const seenInCat = new Set();
    for (const [encodedKey, entry] of Object.entries(entries)) {
      const ud = entry.userData || {};
      const email = (entry.email || ud.email || '').trim();
      const name = entry.name || ud.name || '';
      if (!isValidEmail(email)) { skipped++; continue; }
      const key = email.toLowerCase().trim();
      if (seenInCat.has(key)) continue;
      seenInCat.add(key);
      emails.push({ email, name, category, source: 'web', encodedKey });
    }
  }
  if (skipped > 0) console.log(`  Skipped ${skipped} invalid email entries in emailCategories.`);
  return emails;
}

async function getQueueEmails() {
  const data = await pfGet('queue');
  if (!data || typeof data !== 'object') return [];
  const emails = [];
  let skipped = 0;
  for (const [key, item] of Object.entries(data)) {
    const email = (item.email || '').trim();
    if (!isValidEmail(email)) { skipped++; continue; }
    emails.push({ email, name: item.name || '', category: 'promo', source: 'queue', queueKey: key, retryCount: item.retryCount || 0 });
  }
  if (skipped > 0) console.log(`  Skipped ${skipped} invalid email entries in queue.`);
  return emails;
}

async function getUserState(email) {
  const data = await pfGet(`user-state/${encodeKey(email)}`);
  return data || {};
}

async function updateUserState(email, updates) {
  await pfPatch(`user-state/${encodeKey(email)}`, updates);
}

function lastSendTime(state) {
  return [state.lastSentAt, state.lastPromoSentAt].filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
}

async function shouldSkipDueToHold(email) {
  const state = await getUserState(email);
  if (!state.lastSentAt) return false;
  return daysBetween(state.lastSentAt, todayStr()) < HOLD_DAYS;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n=== Unified Email Campaign: ${new Date().toISOString()} ===\n`);
  if (DRY_RUN) console.log('  \u{1F7E1} DRY RUN \u2014 no emails sent\n');

  const meta = await getMeta();
  const today = todayStr();

  if (meta.lastRunDate !== today) {
    meta.templateCounter = meta.templateCounter || 0;
    meta.lastRunDate = today;
  }

  // Purge blocked emails (incl. owner/admin) from all recipient pools so they
  // are never re-processed or re-queued by the daily campaign.
  try {
    const purged = await removeBlockedEmails(Array.from(BLOCKED_EMAILS));
    if (purged > 0) console.log(`Purged ${purged} blocked entries from queue/sent/emailCategories.`);
  } catch (e) {
    console.warn('[send-bulk] Failed to purge blocked emails:', e.message);
  }

  const status = await getProviderStatus();
  const remaining = Math.min(DAILY_CAP, status.mailjet.remaining + status.brevo.remaining);
  console.log(`Daily budget: ${DAILY_CAP} (using ${remaining} remaining today)`);

  console.log('\nFetching web emails from emailCategories...');
  const webEmails = await getAllWebEmails();
  console.log(`Found ${webEmails.length} web email entries.\n`);

  console.log('Fetching promo emails from queue...');
  const promoEmails = await getQueueEmails();
  console.log(`Found ${promoEmails.length} promo email entries in queue.\n`);

  const dedupMap = new Map();

  for (const e of webEmails) {
    const key = e.email.toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, { email: e.email, name: e.name, categories: [], source: 'web' });
    }
    const entry = dedupMap.get(key);
    if (!entry.categories.includes(e.category)) entry.categories.push(e.category);
  }

  for (const e of promoEmails) {
    const key = e.email.toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, { email: e.email, name: e.name, categories: ['promo'], source: 'promo', queueKey: e.queueKey, retryCount: e.retryCount });
    } else {
      const entry = dedupMap.get(key);
      if (!entry.categories.includes('promo')) entry.categories.push('promo');
      entry.source = 'both';
      entry.queueKey = entry.queueKey || e.queueKey;
      entry.retryCount = Math.max(entry.retryCount || 0, e.retryCount || 0);
    }
  }

  const blockedEmails = ['vibhuteonkar588@gmail.com', 'harshadyadav2122005@gmail.com', 'atharvajangam159@gmail.com'];
  const blockedSet = new Set(blockedEmails.map(e => e.toLowerCase()));

  let entries = Array.from(dedupMap.values()).filter(e => {
    if (!isValidEmail(e.email)) {
      console.log(`  \u2299 Invalid email: ${e.email}`);
      return false;
    }
    if (isBlocked(e.email) || blockedSet.has(e.email.toLowerCase())) {
      console.log(`  \u2299 Blocked: ${e.email}`);
      return false;
    }
    return true;
  });

  console.log(`\nTotal unique recipients after dedup: ${entries.length}\n`);

  const webEntries = [];
  const promoEntries = [];
  for (const e of entries) {
    if (e.categories.includes('promo') && !primaryCategory(e)) promoEntries.push(e);
    else webEntries.push(e);
  }

  webEntries.sort((a, b) => {
    const pa = categoryPriority(primaryCategory(a));
    const pb = categoryPriority(primaryCategory(b));
    if (pa !== pb) return pa - pb;
    return (a.email || '').localeCompare(b.email || '');
  });

  const counts = {};
  for (const e of webEntries) {
    const cat = primaryCategory(e);
    counts[cat] = (counts[cat] || 0) + 1;
  }
  console.log('[Web emails — priority order]');
  for (const cat of WEB_CATEGORY_ORDER) {
    if (counts[cat]) console.log(`  ${cat.padEnd(30)} ${counts[cat]}`);
  }
  console.log(`  ${'promo'.padEnd(30)} ${promoEntries.length} (sent after all web emails)`);
  console.log();

  const ordered = [...webEntries, ...promoEntries];

  const toSend = [];
  for (const e of ordered) {
    const isPromo = e.categories.includes('promo') && !primaryCategory(e);
    // 5-day hold applies ONLY to web emails. Promo (from queue) is always sent.
    if (!isPromo && await shouldSkipDueToHold(e.email)) {
      const state = await getUserState(e.email);
      console.log(`  \u25c7 Skipped ${e.email} (web, last sent ${lastSendTime(state)?.slice(0, 10)})`);
      continue;
    }
    toSend.push(e);
  }
  console.log(`Ready to send: ${toSend.length} (web ${webEntries.length}, promo ${promoEntries.length})\n`);

  const batch = toSend.slice(0, remaining);

  console.log(`Sending up to ${batch.length} emails — web first, then promo (${SEND_DELAY_MS}ms throttle)...\n`);

  let sent = 0, errors = 0, sentPromo = 0;
  let templateCounter = meta.templateCounter || 0;

  for (const e of batch) {
    try {
      const isPromo = e.categories.includes('promo') && !primaryCategory(e);
      const primaryCat = isPromo ? 'promo' : primaryCategory(e);
      const tpl = pickTemplate(primaryCat, isPromo ? templateCounter : 0);
      const subject = typeof tpl.subject === 'function' ? tpl.subject(e.name) : tpl.subject;
      const text = typeof tpl.body === 'function' ? tpl.body(e.name) : '';

      if (DRY_RUN) {
        console.log(`  \u25c7 ${e.email} [${primaryCat}] — "${subject}" (dry-run)`);
        sent++;
        if (isPromo) sentPromo++;
        continue;
      }

      const result = await sendEmail({
        to: e.email,
        toName: e.name,
        subject,
        text,
        headers: isPromo ? {
          'X-Mailer': 'DEV/CRAFT-Bulk/1.0',
        } : undefined,
      });

      const stateUpdates = { lastCategory: primaryCat, lastSource: result.provider };
      if (isPromo) stateUpdates.lastPromoSentAt = new Date().toISOString();
      else stateUpdates.lastSentAt = new Date().toISOString();
      await updateUserState(e.email, stateUpdates);

      await logEmailSend({
        email: e.email, name: e.name, type: primaryCat, subject, status: 'sent', messageId: result.messageId || '',
      });

      sent++;
      if (isPromo) {
        sentPromo++;
        templateCounter++;
      }
      console.log(`  \u2713 ${e.email} [${primaryCat}] via ${result.provider}`);

      if (isPromo && e.queueKey) {
        // Move to `sent` category so it is never picked up for promo again.
        await pfPut(`sent/${encodeKey(e.queueKey)}`, {
          name: e.name,
          email: e.email,
          sentAt: new Date().toISOString(),
          messageId: result.messageId || '',
          type: 'promo',
          source: e.source || 'queue',
        });
        await pfDelete(`queue/${encodeKey(e.queueKey)}`);
      }

      if (!isPromo && primaryCat === 'internship_application') {
        const queueKey = encodeKey(e.email);
        const existingQueue = await pfGet(`queue/${queueKey}`);
        if (!existingQueue && !isBlocked(e.email)) {
          await pfPut(`queue/${queueKey}`, { email: e.email, name: e.name, addedAt: new Date().toISOString(), source: `auto_from_${primaryCat}` });
          console.log(`  \u2192 Added ${e.email} to promo queue (auto from ${primaryCat})`);
        }
      }

      if (SEND_DELAY_MS > 0 && sent < batch.length) await sleep(SEND_DELAY_MS);
    } catch (err) {
      errors++;
      console.error(`  \u2717 ${e.email}: ${err.message}`);
    }
  }

  meta.templateCounter = templateCounter;
  await saveMeta(meta);

  console.log(`\n=== Done: ${sent} sent (${sentPromo} promo), ${errors} errors ===\n`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

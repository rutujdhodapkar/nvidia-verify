import 'dotenv/config';
import { sendEmail, getProviderStatus } from '../lib/email-provider.js';
import { isBlocked } from '../lib/blocklist.js';
import {
  pfGet, pfPut, pfPatch, pfDelete, encodeKey, removeBlockedEmails,
} from '../lib/portfolio-firebase.js';
import { logEmailSend } from '../lib/firebase.js';

const SITE = 'devcraft.fennark.xyz';
const HOLD_DAYS = 5;

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
      subject: 'Your virtual internship is waiting',
      body: (name) => `Hi ${name || 'there'},

DEV/CRAFT is now accepting applications for virtual internships across 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.

When you apply and enroll, you get an instant offer letter. Then you spend 6 weeks building real, production-grade projects that go straight into your portfolio.

It takes 2 minutes to apply. No interviews. No waiting.

Apply now: https://${SITE}

Best,
The DEV/CRAFT Team`,
    },
    {
      subject: 'Your offer letter is ready — just apply',
      body: (name) => `Hi ${name || 'there'},

At DEV/CRAFT, the offer letter arrives the moment you enroll. No screening rounds. No waiting for approvals.

Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, Data Analytics, and more. Each program is 6 weeks, self-paced, and built around projects that teach you real skills.

Your certificate comes with a live verification link employers can check in seconds.

Enroll now: https://${SITE}

Best,
The DEV/CRAFT Team`,
    },
    {
      subject: 'Get certified in just 6 weeks — free to start',
      body: (name) => `Hi ${name || 'there'},

Start your DEV/CRAFT virtual internship today. Complete 6 weeks of real projects and earn a certificate with live verification.

20+ domains available. Self-paced. No experience required.

Start free: https://${SITE}

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
  await pfPut('meta', meta);
}

async function getAllWebEmails() {
  const cats = await pfGet('emailCategories');
  if (!cats || typeof cats !== 'object') return [];
  const emails = [];
  for (const [category, entries] of Object.entries(cats)) {
    if (!entries || typeof entries !== 'object') continue;
    for (const [encodedKey, entry] of Object.entries(entries)) {
      const email = (entry.email || entry.name || '').trim() || encodedKey.replace(/_/g, '.');
      emails.push({ email, name: entry.name || '', category, source: 'web', encodedKey });
    }
  }
  return emails;
}

async function getQueueEmails() {
  const data = await pfGet('queue');
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).map(([key, item]) => ({
    email: item.email || key,
    name: item.name || '',
    category: 'promo',
    source: 'queue',
    queueKey: key,
    retryCount: item.retryCount || 0,
  }));
}

async function getSentEmails() {
  const data = await pfGet('sent');
  if (!data || typeof data !== 'object') return [];
  return Object.values(data).filter(e => e.email);
}

async function getUserState(email) {
  const data = await pfGet(`user-state/${encodeKey(email)}`);
  return data || {};
}

async function updateUserState(email, updates) {
  await pfPatch(`user-state/${encodeKey(email)}`, updates);
}

async function shouldSkipDueToHold(email, type = 'web') {
  const state = await getUserState(email);
  const field = type === 'promo' ? 'lastPromoSentAt' : 'lastSentAt';
  const val = state[field];
  if (!val) return false;
  return daysBetween(val, todayStr()) < HOLD_DAYS;
}

async function main() {
  console.log(`\n=== Unified Email Campaign: ${new Date().toISOString()} ===\n`);

  const meta = await getMeta();
  const today = todayStr();

  if (meta.lastRunDate !== today) {
    meta.templateCounter = meta.templateCounter || 0;
    meta.lastRunDate = today;
  }

  const status = await getProviderStatus();
  console.log(`Daily capacity: Mailjet ${status.mailjet.remaining}/${status.mailjet.limit}, Brevo ${status.brevo.remaining}/${status.brevo.limit}`);

  console.log('\nFetching web emails from emailCategories...');
  let webEmails = await getAllWebEmails();
  console.log(`Found ${webEmails.length} web email entries.\n`);

  console.log('Fetching promo emails from queue...');
  let promoEmails = await getQueueEmails();
  console.log(`Found ${promoEmails.length} promo email entries in queue.\n`);

  console.log('Processing sent emails for promo re-targeting...');
  const sentEmails = await getSentEmails();
  const sentEmailSet = new Set(sentEmails.map(e => e.email?.toLowerCase().trim()).filter(Boolean));
  console.log(`Found ${sentEmails.length} sent entries, will re-target as promo.\n`);

  let templateCounter = meta.templateCounter || 0;

  const dedupMap = new Map();

  for (const e of webEmails) {
    const key = e.email.toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, { email: e.email, name: e.name, categories: [], source: 'web' });
    }
    dedupMap.get(key).categories.push(e.category);
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

  for (const email of sentEmailSet) {
    const key = email.toLowerCase().trim();
    if (!dedupMap.has(key)) {
      dedupMap.set(key, { email, name: '', categories: ['promo'], source: 'promo' });
    } else {
      const entry = dedupMap.get(key);
      if (!entry.categories.includes('promo')) entry.categories.push('promo');
    }
  }

  let entries = Array.from(dedupMap.values());

  const blockedEmails = ['vibhuteonkar588@gmail.com', 'harshadyadav2122005@gmail.com', 'atharvajangam159@gmail.com'];
  const blockedSet = new Set(blockedEmails.map(e => e.toLowerCase()));

  entries = entries.filter(e => {
    if (isBlocked(e.email) || blockedSet.has(e.email.toLowerCase())) {
      console.log(`  \u2299 Blocked: ${e.email}`);
      return false;
    }
    return true;
  });

  console.log(`\nTotal unique recipients after dedup: ${entries.length}\n`);

  const toSend = [];
  for (const e of entries) {
    const isPromo = e.categories.includes('promo');
    if (!isPromo && await shouldSkipDueToHold(e.email, 'web')) {
      const state = await getUserState(e.email);
      console.log(`  \u25c7 Skipped ${e.email} (web, last sent ${state.lastSentAt?.slice(0, 10)})`);
      continue;
    }
    toSend.push(e);
  }
  console.log(`Ready to send: ${toSend.length}\n`);

  const totalRemaining = status.mailjet.remaining + status.brevo.remaining;
  const batch = toSend.slice(0, totalRemaining);

  console.log(`Sending up to ${batch.length} emails via unified provider (fallback on failure)...\n`);

  let sent = 0, errors = 0;

  for (const e of batch) {
    try {
      const isPromo = e.categories.includes('promo');
      const primaryCat = isPromo ? 'promo' : (e.categories.find(c => c !== 'promo') || e.categories[0]);
      const tpl = pickTemplate(primaryCat, templateCounter);
      const subject = typeof tpl.subject === 'function' ? tpl.subject(e.name) : tpl.subject;
      const text = typeof tpl.body === 'function' ? tpl.body(e.name) : '';

      const result = await sendEmail({
        to: e.email,
        toName: e.name,
        subject,
        text,
      });

      await updateUserState(e.email, {
        lastSentAt: new Date().toISOString(),
        lastCategory: primaryCat,
        lastSource: result.provider,
      });
      await logEmailSend({
        email: e.email, name: e.name, type: primaryCat, subject, status: 'sent', messageId: result.messageId || '',
      });

      sent++;
      templateCounter++;
      console.log(`  \u2713 ${e.email} [${primaryCat}] via ${result.provider}`);

      if (isPromo && e.queueKey) {
        await pfDelete(`queue/${encodeKey(e.queueKey)}`);
      }

      if (!isPromo && (primaryCat === 'internship_application' || sentEmailSet.has(e.email.toLowerCase()))) {
        const queueKey = encodeKey(e.email);
        const existingQueue = await pfGet(`queue/${queueKey}`);
        if (!existingQueue) {
          await pfPut(`queue/${queueKey}`, { email: e.email, name: e.name, addedAt: new Date().toISOString(), source: `auto_from_${primaryCat}` });
          console.log(`  \u2192 Added ${e.email} to promo queue (auto from ${primaryCat})`);
        }
      }
    } catch (err) {
      errors++;
      console.error(`  \u2717 ${e.email}: ${err.message}`);
    }
  }

  meta.templateCounter = templateCounter;
  await saveMeta(meta);

  console.log(`\n=== Done: ${sent} sent, ${errors} errors ===\n`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

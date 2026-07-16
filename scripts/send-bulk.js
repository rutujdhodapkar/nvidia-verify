import 'dotenv/config';
import { sendEmail } from '../lib/mailjet.js';
import { sendBrevoEmail } from '../lib/brevo.js';
import { isBlocked } from '../lib/blocklist.js';
import {
  pfGet, pfPut, pfPatch, pfDelete, pfPush, encodeKey, removeBlockedEmails,
} from '../lib/portfolio-firebase.js';
import { logEmailSend } from '../lib/firebase.js';

const SITE = 'devcraft.fennark.xyz';
const FROM_EMAIL = 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';
const MAILJET_DAILY = 200;
const BREVO_DAILY = 300;
const HOLD_DAYS = 5;

function renderBody(bodyContent) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@media only screen and (max-width:480px){
  .card{padding:16px!important}
  .header{padding:20px 16px!important}
  .header h1{font-size:18px!important}
  .btn{display:block!important;text-align:center!important;padding:14px 20px!important;font-size:16px!important;width:auto!important}
  .content{padding:16px!important;font-size:14px!important}
}
</style></head>
<body style="margin:0;padding:0;background:#f4f4f4;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div class="card" style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
${bodyContent}
</div></body></html>`;
}

function headerHtml(gradient, title) {
  return `<div class="header" style="background:${gradient};padding:30px;text-align:center">
<h1 style="color:#fff;margin:0;font-size:22px">${title}</h1></div>`;
}

function btnHtml(url, color, text) {
  return `<p style="text-align:center;margin:24px 0"><a href="${url}" class="btn" style="display:inline-block;background:${color};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">${text}</a></p>`;
}

const templates = {
  welcome: {
    subject: 'Welcome to DEV/CRAFT! Start Your Internship Journey',
    body: (name) => `${headerHtml('linear-gradient(135deg,#6366f1,#8b5cf6)','Welcome to DEV/CRAFT')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>Thanks for signing up! You're now part of the DEV/CRAFT community.</p>
<p><strong>Next step:</strong> Complete your profile and select your internship domain to receive your offer letter with a unique Intern ID.</p>
<p>Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.</p>
${btnHtml('https://'+SITE,'#6366f1','Get Started')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  login: {
    subject: 'Continue Your DEV/CRAFT Internship',
    body: (name) => `${headerHtml('linear-gradient(135deg,#059669,#10b981)','Your Internship Awaits')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>We noticed you've logged in but haven't completed your enrollment yet.</p>
<p>Select your domain to receive your instant offer letter and start working on real projects. It takes just 2 minutes.</p>
${btnHtml('https://'+SITE,'#059669','Choose Your Domain')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  internship_application: {
    subject: 'Your DEV/CRAFT Application — Next Steps',
    body: (name) => `${headerHtml('linear-gradient(135deg,#2563eb,#3b82f6)','Application Received')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>Your internship application has been received! Here's what happens next:</p>
<ul><li>Complete your payment to activate your internship</li><li>Receive your offer letter with a unique Intern ID</li><li>Start working on 6 weeks of real projects</li><li>Earn your completion certificate with live verification</li></ul>
${btnHtml('https://'+SITE,'#2563eb','Complete Enrollment')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  payment_success: {
    subject: 'Payment Confirmed — Your Internship is Active',
    body: (name) => `${headerHtml('linear-gradient(135deg,#059669,#10b981)','Payment Successful')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>Your payment has been confirmed. Your internship is now fully active!</p>
<p>You can start working on your projects immediately. Complete all tasks to earn your certificate.</p>
${btnHtml('https://'+SITE,'#059669','Go to Dashboard')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  all_done_with_payment: {
    subject: 'Congratulations! Your Internship is Complete',
    body: (name) => `${headerHtml('linear-gradient(135deg,#7c3aed,#a855f7)','Internship Complete')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>Congratulations on completing your DEV/CRAFT internship! Your certificate is ready with a live verification link.</p>
<p>Share your achievement on LinkedIn and tag DEV/CRAFT. Stay tuned for advanced programs and referral rewards.</p>
${btnHtml('https://'+SITE,'#7c3aed','View Certificate')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  all_tasks_done_no_payment: {
    subject: 'Complete Your Payment to Get Certified',
    body: (name) => `${headerHtml('linear-gradient(135deg,#f59e0b,#d97706)','Almost There!')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>You've completed all your tasks — great work! Just one more step: complete your payment to unlock your certificate.</p>
${btnHtml('https://'+SITE,'#f59e0b','Complete Payment')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  internship_expired: {
    subject: 'Your Internship Has Expired — Re-apply Now',
    body: (name) => `${headerHtml('linear-gradient(135deg,#dc2626,#ef4444)','Time to Re-Apply')}
<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>Your previous internship period has ended. But don't worry — you can re-apply and continue from where you left off.</p>
${btnHtml('https://'+SITE,'#dc2626','Re-Apply Now')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
  },
  promo: [
    {
      subject: 'Your virtual internship is waiting',
      body: (name) => `<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>DEV/CRAFT is now accepting applications for virtual internships across 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.</p>
<p>When you apply and enroll, you get an instant offer letter. Then you spend 6 weeks building real, production-grade projects that go straight into your portfolio.</p>
<p>It takes 2 minutes to apply. No interviews. No waiting.</p>
${btnHtml('https://'+SITE,'#2563eb','Apply Now')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
      text: (name) => `Hi ${name || 'there'},\n\nDEV/CRAFT is now accepting applications for virtual internships across 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.\n\nWhen you apply and enroll, you get an instant offer letter. Then you spend 6 weeks building real, production-grade projects that go straight into your portfolio.\n\nIt takes 2 minutes to apply. No interviews. No waiting.\n\n${SITE}\n\nBest,\nThe DEV/CRAFT Team`,
    },
    {
      subject: 'Your offer letter is ready — just apply',
      body: (name) => `<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>At DEV/CRAFT, the offer letter arrives the moment you enroll. No screening rounds. No waiting for approvals.</p>
<p>Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, Data Analytics, and more. Each program is 6 weeks, self-paced, and built around projects that teach you real skills.</p>
<p>Your certificate comes with a live verification link employers can check in seconds.</p>
${btnHtml('https://'+SITE,'#059669','Enroll Now')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
      text: (name) => `Hi ${name || 'there'},\n\nAt DEV/CRAFT, the offer letter arrives the moment you enroll. No screening rounds. No waiting for approvals.\n\nChoose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, Data Analytics, and more. Each program is 6 weeks, self-paced, and built around projects that teach you real skills.\n\nYour certificate comes with a live verification link employers can check in seconds.\n\n${SITE}\n\nBest,\nThe DEV/CRAFT Team`,
    },
    {
      subject: 'Get certified in just 6 weeks — free to start',
      body: (name) => `<div class="content" style="padding:24px">
<p>Hi ${name || 'there'},</p>
<p>Start your DEV/CRAFT virtual internship today. Complete 6 weeks of real projects and earn a certificate with live verification.</p>
<p>20+ domains available. Self-paced. No experience required.</p>
${btnHtml('https://'+SITE,'#7c3aed','Start Free')}
<p>Best,<br>The DEV/CRAFT Team</p></div>`,
      text: (name) => `Hi ${name || 'there'},\n\nStart your DEV/CRAFT virtual internship today. Complete 6 weeks of real projects and earn a certificate with live verification.\n\n20+ domains available. Self-paced. No experience required.\n\n${SITE}\n\nBest,\nThe DEV/CRAFT Team`,
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
    for (const [encodedEmail] of Object.entries(entries)) {
      const email = encodedEmail.replace(/_/g, match => match === '_at_' ? '@' : match === '_dot_' ? '.' : match);
      const decodedEmail = encodedEmail.replace(/_/g, '@').replace(/,/g, '.');
      emails.push({ email: decodedEmail, name: '', category, source: 'web', encodedKey: encodedEmail });
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
    meta.dailyMailjetCount = 0;
    meta.dailyBrevoCount = 0;
    meta.lastRunDate = today;
    meta.templateCounter = meta.templateCounter || 0;
  }

  const mailjetRemaining = MAILJET_DAILY - (meta.dailyMailjetCount || 0);
  const brevoRemaining = BREVO_DAILY - (meta.dailyBrevoCount || 0);
  console.log(`Daily capacity: Mailjet ${mailjetRemaining}/${MAILJET_DAILY}, Brevo ${brevoRemaining}/${BREVO_DAILY}`);

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

  const webEntries = [];
  const promoEntries = [];
  for (const e of entries) {
    const isPromo = e.categories.includes('promo');
    if (!isPromo && await shouldSkipDueToHold(e.email, 'web')) {
      const state = await getUserState(e.email);
      console.log(`  \u25c7 Skipped ${e.email} (web, last sent ${state.lastSentAt?.slice(0, 10)})`);
      continue;
    }
    // Promo has 13k recipients and 500/day cap — won't loop back for 26 days, no hold needed

    if (isPromo) promoEntries.push(e); else webEntries.push(e);
  }
  console.log(`Ready to send: ${webEntries.length} web, ${promoEntries.length} promo\n`);

  let mailjetSent = 0, brevoSent = 0, errors = 0;

  // Phase 1: Web emails via Mailjet (priority)
  console.log('[Phase 1: Web Emails via Mailjet]');
  const webToSend = webEntries.slice(0, mailjetRemaining);
  for (const e of webToSend) {
    try {
      const primaryCat = e.categories.find(c => c !== 'promo') || e.categories[0];
      const tpl = pickTemplate(primaryCat);
      const subject = typeof tpl.subject === 'function' ? tpl.subject(e.name) : tpl.subject;
      const html = renderBody(typeof tpl.body === 'function' ? tpl.body(e.name) : '');
      const headers = { 'X-Category': primaryCat };

      const result = await sendEmail({ to: e.email, toName: e.name, subject, html, fromEmail: FROM_EMAIL, fromName: FROM_NAME, headers });
      const messageId = result?.Messages?.[0]?.To?.[0]?.MessageID || '';

      await updateUserState(e.email, { lastSentAt: new Date().toISOString(), lastCategory: primaryCat, lastSource: 'mailjet' });
      await logEmailSend({ email: e.email, name: e.name, type: `web_${primaryCat}`, subject, status: 'sent', messageId });

      mailjetSent++;
      console.log(`  \u2713 ${e.email} [${primaryCat}] via Mailjet`);

      // Move to promo: if internship_application or sent, add to queue
      if (primaryCat === 'internship_application' || sentEmailSet.has(e.email.toLowerCase())) {
        const queueKey = encodeKey(e.email);
        const existingQueue = await pfGet(`queue/${queueKey}`);
        if (!existingQueue) {
          await pfPut(`queue/${queueKey}`, { email: e.email, name: e.name, addedAt: new Date().toISOString(), source: `auto_from_${primaryCat}` });
          console.log(`  \u2192 Added ${e.email} to promo queue (auto from ${primaryCat})`);
        }
      }
    } catch (err) {
      console.error(`  \u2717 ${e.email}: ${err.message}`);
      errors++;
    }
  }
  console.log(`Web sent: ${mailjetSent}/${webToSend.length}\n`);

  // Phase 2: Promo emails via remaining Mailjet + Brevo
  const remainingMailjet = mailjetRemaining - mailjetSent;
  const promoMailjetAllocation = Math.min(promoEntries.length, remainingMailjet);
  const promoBrevoAllocation = Math.min(promoEntries.length - promoMailjetAllocation, brevoRemaining);

  console.log('[Phase 2: Promo Emails]');
  console.log(`Allocation: Mailjet ${promoMailjetAllocation}, Brevo ${promoBrevoAllocation}\n`);

  let promoIdx = 0;

  for (const e of promoEntries) {
    if (promoIdx >= promoMailjetAllocation + promoBrevoAllocation) break;

    try {
      const tpl = pickTemplate('promo', templateCounter);
      const subject = tpl.subject;
      const html = renderBody(tpl.body(e.name));
      const text = tpl.text ? tpl.text(e.name) : undefined;

      let messageId = '';
      if (promoIdx < promoMailjetAllocation) {
        const headers = { 'X-Category': 'promo', Precedence: 'bulk' };
        const result = await sendEmail({ to: e.email, toName: e.name, subject, html, text, fromEmail: FROM_EMAIL, fromName: FROM_NAME, headers });
        messageId = result?.Messages?.[0]?.To?.[0]?.MessageID || '';
        mailjetSent++;
        console.log(`  \u2713 ${e.email} [promo] via Mailjet`);
      } else {
        const result = await sendBrevoEmail({ to: e.email, toName: e.name, subject, htmlContent: html, textContent: text });
        messageId = result?.messageId || '';
        brevoSent++;
        console.log(`  \u2713 ${e.email} [promo] via Brevo`);
      }

      await updateUserState(e.email, { lastPromoSentAt: new Date().toISOString(), lastCategory: 'promo', lastSource: promoIdx < promoMailjetAllocation ? 'mailjet' : 'brevo' });
      await logEmailSend({ email: e.email, name: e.name, type: 'promo', subject, status: 'sent', messageId });

      templateCounter++;

      // Remove from queue if it came from there
      if (e.queueKey) {
        await pfDelete(`queue/${encodeKey(e.queueKey)}`);
      }
    } catch (err) {
      console.error(`  \u2717 ${e.email}: ${err.message}`);
      errors++;
    }
    promoIdx++;
  }
  console.log(`Promo sent: ${Math.min(promoIdx, promoMailjetAllocation + promoBrevoAllocation)} (MJ: ${Math.min(promoIdx, promoMailjetAllocation)}, BV: ${Math.max(0, promoIdx - promoMailjetAllocation)})\n`);

  // Update meta
  meta.dailyMailjetCount = (meta.dailyMailjetCount || 0) + mailjetSent;
  meta.dailyBrevoCount = (meta.dailyBrevoCount || 0) + brevoSent;
  meta.templateCounter = templateCounter;
  await saveMeta(meta);

  console.log(`=== Done: ${mailjetSent} Mailjet, ${brevoSent} Brevo, ${errors} errors ===\n`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

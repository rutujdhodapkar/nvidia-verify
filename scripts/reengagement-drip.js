// DEV/CRAFT Re-engagement Drip (win-back preview via Resend)
// Finds mailing-list contacts (Firebase `queue`) who haven't been engaged in
// 30+ days, excludes anyone already converted (present in root CSVs), and
// PREVIEWS a 3-step win-back sequence spaced a few days apart.
//
// SAFETY: this script is DRY-RUN ONLY by default. It cannot send an email to
// anyone unless ALL THREE gates are set at once:
//   1. CLI flag:        --send
//   2. Env var:         WINBACK_SEND=1
//   3. NODE_ENV=production
// Even then, SANDBOX_EMAIL (set in .env) reroutes every mail to your inbox.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { sendResendEmail } from '../lib/resend.js';
import { isBlocked } from '../lib/blocklist.js';

const FIREBASE_URL = process.env.PORTFOLIO_FIREBASE_URL || 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const SITE_URL = process.env.SITE_URL || 'https://devcraft.fennark.xyz';
const APPLY_URL = process.env.APPLY_URL || `${SITE_URL}/apply`;

const WINBACK_AFTER_DAYS = Number(process.env.WINBACK_AFTER_DAYS || 30);
const STEP_GAP_DAYS = Number(process.env.WINBACK_STEP_GAP_DAYS || 4);
const MAX_SENDS_PER_RUN = Number(process.env.WINBACK_MAX_PER_RUN || 40);

// Triple gate: nothing is ever sent unless --send + WINBACK_SEND=1 + production.
const SEND_ENABLED = process.argv.includes('--send')
  && process.env.WINBACK_SEND === '1'
  && process.env.NODE_ENV === 'production';
const DRY_RUN = !SEND_ENABLED;
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || null;

// ---------- firebase helpers ----------
async function fb(pathname, method = 'GET', body = null) {
  const res = await fetch(`${FIREBASE_URL}/${pathname}.json`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firebase ${method} ${pathname}: ${res.status}`);
  return res.json().catch(() => null);
}
const get = (p) => fb(p, 'GET');
const patch = (p, d) => fb(p, 'PATCH', d);

function encodeKey(str) {
  return (str || '').toLowerCase().replace(/[.#$\/\[\]]/g, '_');
}

// ---------- utils ----------
const daysBetween = (d1, d2) => Math.floor((new Date(d2) - new Date(d1)) / 86400000);
function firstName(name) { return (name || '').trim().split(/\s+/)[0] || 'there'; }
const VALID_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function collectConvertedEmails() {
  const converted = new Set();
  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  for (const dir of [process.cwd(), path.join(process.cwd(), 'data')]) {
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.csv')) continue;
      try {
        for (const m of fs.readFileSync(path.join(dir, f), 'utf8').match(emailRe) || []) {
          converted.add(m.toLowerCase().trim());
        }
      } catch { /* skip unreadable */ }
    }
  }
  return converted;
}

// ---------- drip templates ----------
function buildHtml({ eyebrow, headline, first, body, ctaText }) {
  return `<!DOCTYPE html>
<html><body style="margin:0; padding:0; background-color:#efefef; font-family:'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efefef; padding:48px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; max-width:600px; width:100%; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr><td style="padding:36px 40px 0 40px; font-size:18px; font-weight:800; color:#000000;">&#8997; DevCraft</td></tr>
      <tr><td style="padding:28px 40px 0 40px;">
        <span style="display:inline-block; background-color:#000000; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; padding:6px 14px; border-radius:100px;">${eyebrow}</span>
      </td></tr>
      <tr><td style="padding:16px 40px 0 40px;"><h1 style="margin:0; font-size:26px; line-height:1.3; font-weight:800; letter-spacing:-0.5px;">${headline}</h1></td></tr>
      <tr><td style="padding:20px 40px 0 40px;">
        <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#333333;">Hi ${first},</p>
        <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#333333;">${body}</p>
      </td></tr>
      <tr><td style="padding:12px 40px 8px 40px;">
        <a href="${APPLY_URL}" target="_blank" style="display:inline-block; background-color:#000000; color:#ffffff; padding:14px 32px; font-size:14px; font-weight:700; text-decoration:none; border-radius:10px;">${ctaText} &rarr;</a>
      </td></tr>
      <tr><td style="padding:40px 40px 32px 40px;">
        <div style="border-top:1px solid #ececec; padding-top:24px;">
          <p style="margin:0 0 10px 0; font-size:11px; line-height:1.6; color:#aaaaaa;">DEVCRAFT &mdash; VIRTUAL INTERNSHIP PLATFORM BY FENNARK</p>
          <p style="margin:0; font-size:10px; color:#cccccc;">&copy; ${new Date().getFullYear()} Fennark. <a href="${SITE_URL}?unsubscribe=1" style="color:#cccccc;">Unsubscribe</a></p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const STEPS = [
  {
    subject: (n) => `${n}, we saved your spot`,
    vars: (first) => ({
      eyebrow: 'STILL INTERESTED',
      headline: 'Your internship spot is waiting',
      first,
      body: "It's been a while since you looked at DevCraft. New cohort projects across AI, Web Development, Cloud and Design just dropped — and your progress from before still counts.",
      ctaText: 'Claim My Spot',
    }),
  },
  {
    subject: () => `What's changed since you left`,
    vars: (first) => ({
      eyebrow: "WHAT'S NEW",
      headline: 'A lot has changed at DevCraft',
      first,
      body: 'New mentor-led project tracks, faster certificate verification, and a referral program that pays. Here is what you missed — come see if the timing is better now.',
      ctaText: "See What's New",
    }),
  },
  {
    subject: () => `Last nudge — then we'll stop`,
    vars: (first) => ({
      eyebrow: 'FINAL NOTICE',
      headline: 'Should we close your file?',
      first,
      body: "We don't want to clutter your inbox. This is our last email about your pending DevCraft application — reply STOP to opt out, or click below to finish enrolling in 2 minutes.",
      ctaText: 'Finish Enrolling',
    }),
  },
];

// ---------- eligibility ----------
async function findEligible(queue, promoStates, converted) {
  const eligible = [];
  const now = new Date();

  for (const [key, user] of Object.entries(queue)) {
    const email = (user?.email || key.replace(/_/g, '.')).toLowerCase();
    if (!VALID_EMAIL.test(email)) continue;
    if (isBlocked(email) || converted.has(email)) continue;

    const wb = (await get(`winback/${encodeKey(email)}`)) || {};
    if ((wb.step || 0) >= STEPS.length) continue; // sequence finished

    // last touch = last promo/web send, else when added to queue
    const promoState = promoStates[encodeKey(email)] || {};
    const lastTouch = promoState.lastSentAt || user.addedAt;
    if (!lastTouch || daysBetween(lastTouch, now) < WINBACK_AFTER_DAYS) continue;

    // step pacing
    if (wb.step > 0 && wb.lastSentAt && daysBetween(wb.lastSentAt, now) < STEP_GAP_DAYS) continue;

    eligible.push({ email, name: user.name || '', step: wb.step || 0 });
  }
  return eligible;
}

// ---------- main ----------
async function main() {
  console.log(`=== Win-back Drip ${new Date().toISOString()} ===`);
  console.log(`Rules: inactive >= ${WINBACK_AFTER_DAYS}d, ${STEPS.length} steps, ${STEP_GAP_DAYS}d apart\n`);

  if (!DRY_RUN && SANDBOX_EMAIL) console.log(`MODE: SEND ENABLED — sandbox reroute active, all mail -> ${SANDBOX_EMAIL}\n`);
  else if (!DRY_RUN) console.log('MODE: PRODUCTION — real emails are being sent\n');
  else console.log('MODE: DRY RUN (default) — no emails can be sent. Sending requires --send AND WINBACK_SEND=1 AND NODE_ENV=production\n');

  const [queue, promoStates] = await Promise.all([
    get('queue').then(r => r || {}),
    get('webPromo/promo').then(r => r || {}),
  ]);
  const converted = collectConvertedEmails();
  console.log(`[EXCLUDE] ${converted.size} converted emails found in local CSVs`);

  const eligible = await findEligible(queue, promoStates, converted);
  console.log(`[DRIP] ${eligible.length} contact(s) due this run (cap ${MAX_SENDS_PER_RUN})\n`);

  let processed = 0;
  for (const contact of eligible.slice(0, MAX_SENDS_PER_RUN)) {
    const template = STEPS[contact.step];
    const first = firstName(contact.name);
    const subject = template.subject(first);
    const html = buildHtml(template.vars(first));
    const to = SANDBOX_EMAIL || contact.email;

    if (DRY_RUN) {
      console.log(`  ○ [step ${contact.step + 1}/${STEPS.length}] ${contact.email} — "${subject}"`);
      processed++;
      continue;
    }

    try {
      await sendResendEmail({ to, subject, html });
      await patch(`winback/${encodeKey(contact.email)}`, {
        email: contact.email,
        name: contact.name || '',
        step: contact.step + 1,
        lastSentAt: new Date().toISOString(),
      });
      console.log(`  ✓ [step ${contact.step + 1}/${STEPS.length}] ${to} — "${subject}"`);
      processed++;
      await new Promise(r => setTimeout(r, 2000)); // gentle pacing
    } catch (err) {
      console.error(`  ✗ ${contact.email}: ${err.message}`);
    }
  }

  console.log(`\n=== Done. ${processed} processed. ===`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

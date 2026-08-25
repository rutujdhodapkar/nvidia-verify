// DEV/CRAFT Email Automation (Brevo)
// Phase 1: WEB MAILS  -> users under emailCategories/* , once every 5 days
// Phase 2: PROMO MAILS -> queue/* users, daily, from remaining Brevo quota
// Data + state live in portfolio Firebase RTDB.

const FIREBASE_URL = process.env.PORTFOLIO_FIREBASE_URL || 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';
const SITE_URL = process.env.SITE_URL || 'https://fennark.xyz';
const APPLY_URL = process.env.APPLY_URL || `${SITE_URL}/apply`;

const BREVO_DAILY_LIMIT = 300;
const WEB_MAIL_COOLDOWN_DAYS = 5;
const STATE_BASE = 'webPromo';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || null;
const IS_PROD = process.env.NODE_ENV === 'production';

// ---------- firebase helpers ----------
async function fb(path, method = 'GET', body = null) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Firebase ${method} ${path}: ${res.status}`);
  return res.json().catch(() => null);
}
const get = (p) => fb(p, 'GET');
const put = (p, d) => fb(p, 'PUT', d);
const patch = (p, d) => fb(p, 'PATCH', d);

function encodeKey(str) {
  return (str || '').toLowerCase().replace(/[.#$\/\[\]]/g, '_');
}

// ---------- utils ----------
const todayStr = () => new Date().toISOString().slice(0, 10);
function daysBetween(d1, d2) {
  return Math.floor((new Date(d2) - new Date(d1)) / 86400000);
}
function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || 'there';
}

// ---------- HTML theme (provided) ----------
function buildHtml(vars) {
  const v = {
    eyebrow_label: 'UPDATE',
    subject_line: '',
    first_name: 'there',
    body_text: '',
    cta_link: SITE_URL,
    cta_text: 'Open Dashboard',
    feature_1_title: '', feature_1_desc: '',
    feature_2_title: '', feature_2_desc: '',
    feature_3_title: '', feature_3_desc: '',
    ...vars,
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevCraft</title>
</head>
<body style="margin:0; padding:0; background-color:#efefef; font-family:'Helvetica Neue', Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#efefef; padding:48px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; max-width:600px; width:100%; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="padding:36px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:18px; font-weight:800; color:#000000; letter-spacing:-0.3px;">&#8997; DevCraft</td>
                <td align="right" style="font-size:11px; font-weight:600; color:#999999; letter-spacing:0.5px;">FENNARK</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px 0 40px;">
            <span style="display:inline-block; background-color:#000000; color:#ffffff; font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; padding:6px 14px; border-radius:100px;">
              ${v.eyebrow_label}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 0 40px;">
            <h1 style="margin:0; font-size:26px; line-height:1.3; font-weight:800; color:#000000; letter-spacing:-0.5px;">
              ${v.subject_line}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 0 40px;">
            <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#333333;">Hi ${v.first_name},</p>
            <p style="margin:0 0 14px 0; font-size:15px; line-height:1.7; color:#333333;">${v.body_text}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 40px 8px 40px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#000000; border-radius:10px;">
                  <a href="${v.cta_link}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">
                    ${v.cta_text} &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px 0 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ececec;">
              <tr>
                <td style="padding-top:24px; width:33%; vertical-align:top;">
                  <p style="margin:0 0 4px 0; font-size:13px; font-weight:700; color:#000000;">${v.feature_1_title}</p>
                  <p style="margin:0; font-size:12px; color:#888888; line-height:1.5;">${v.feature_1_desc}</p>
                </td>
                <td style="padding-top:24px; width:33%; vertical-align:top;">
                  <p style="margin:0 0 4px 0; font-size:13px; font-weight:700; color:#000000;">${v.feature_2_title}</p>
                  <p style="margin:0; font-size:12px; color:#888888; line-height:1.5;">${v.feature_2_desc}</p>
                </td>
                <td style="padding-top:24px; width:33%; vertical-align:top;">
                  <p style="margin:0 0 4px 0; font-size:13px; font-weight:700; color:#000000;">${v.feature_3_title}</p>
                  <p style="margin:0; font-size:12px; color:#888888; line-height:1.5;">${v.feature_3_desc}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px 40px;">
            <div style="border-top:1px solid #ececec; padding-top:24px;">
              <p style="margin:0 0 10px 0; font-size:11px; line-height:1.6; color:#aaaaaa; letter-spacing:0.3px;">
                DEVCRAFT &mdash; VIRTUAL INTERNSHIP PLATFORM BY FENNARK
              </p>
              <p style="margin:0 0 10px 0; font-size:11px; line-height:1.6;">
                <a href="${SITE_URL}" style="color:#000000; text-decoration:none; font-weight:600;">Website</a>
                <span style="color:#cccccc;">&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>
                <a href="{{unsubscribe}}" style="color:#000000; text-decoration:none; font-weight:600;">Unsubscribe</a>
              </p>
              <p style="margin:0; font-size:10px; color:#cccccc;">&copy; ${new Date().getFullYear()} Fennark. All rights reserved.</p>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function toText(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rarr;/g, '->').replace(/&mdash;/g, '-').replace(/&bull;/g, '·')
    .replace(/\s{2,}/g, ' ').trim();
}

// ---------- templates ----------
const CATEGORY_CONTENT = {
  login: {
    eyebrow: 'INTERNSHIP UPDATE',
    headline: 'Your DevCraft journey awaits',
    body: 'Your DevCraft account is active. Pick your domain, complete tasks at your pace, and earn a verified certificate that recruiters actually notice.',
    cta: 'Start Learning',
    features: [
      ['Real Projects', 'Hands-on tasks mirroring industry work'],
      ['Certificate', 'Verified completion certificate'],
      ['Flexible', '100% virtual, learn on your schedule'],
    ],
  },
  task_completed: {
    eyebrow: 'PROGRESS UPDATE',
    headline: 'Great progress — keep it going',
    body: "You've been completing tasks consistently. Keep the momentum going — each completed task brings you closer to your certificate.",
    cta: 'Continue Tasks',
    features: [
      ['Next Task', 'Your next challenge is ready'],
      ['Streak', 'Consistency beats intensity'],
      ['Support', 'Mentors available on Discord'],
    ],
  },
  internship_application: {
    eyebrow: 'APPLICATION',
    headline: 'Your application status',
    body: 'Thanks for applying to the DevCraft virtual internship program. Our team is reviewing applications — complete your profile to speed things up.',
    cta: 'Complete Profile',
    features: [
      ['Fast Track', 'Completed profiles reviewed first'],
      ['Domains', 'AI, Web, Cloud, Design & more'],
      ['Zero Fee', 'Application is completely free'],
    ],
  },
  payment_success: {
    eyebrow: 'CONFIRMED',
    headline: 'Payment received — you are all set',
    body: 'Your payment has been confirmed and your internship track is fully activated. Head to your dashboard to see your task list.',
    cta: 'Go to Dashboard',
    features: [
      ['Activated', 'All tasks unlocked'],
      ['Timeline', 'Deadlines visible on dashboard'],
      ['Certificate', 'Issued after final verification'],
    ],
  },
  welcome: {
    eyebrow: 'WELCOME ABOARD',
    headline: 'Welcome to DevCraft',
    body: "We're excited to have you on board! Your virtual internship dashboard is ready — log in anytime and start with Task 1.",
    cta: 'Open Dashboard',
    features: [
      ['Onboarding', 'Guided walkthrough inside'],
      ['Community', 'Join fellow interns on Discord'],
      ['Mentors', 'Help is one message away'],
    ],
  },
  internship_expired: {
    eyebrow: 'RE-ENROLL',
    headline: 'Your internship window ended',
    body: "Your internship window has closed — but you can re-apply anytime and we'll fast-track your enrollment so you don't lose progress.",
    cta: 'Re-apply Now',
    features: [
      ['Fast Track', 'Priority review for returning interns'],
      ['Fresh Start', 'Pick any domain again'],
      ['Progress', 'Previous work stays on record'],
    ],
  },
  all_tasks_done_no_payment: {
    eyebrow: 'FINAL STEP',
    headline: 'One step away from your certificate',
    body: "You've completed every task — impressive! Complete the final step on your dashboard to unlock verification and claim your certificate.",
    cta: 'Finish Setup',
    features: [
      ['Certificate', 'Issued right after final step'],
      ['Verification', 'Shareable verified credential'],
      ['Referrals', 'Earn rewards for referring friends'],
    ],
  },
};
const DEFAULT_CONTENT = CATEGORY_CONTENT.login;

function webMailVars(category, user) {
  const c = CATEGORY_CONTENT[category] || DEFAULT_CONTENT;
  return {
    eyebrow_label: c.eyebrow,
    subject_line: c.headline,
    first_name: firstName(user.name),
    body_text: c.body,
    cta_link: SITE_URL,
    cta_text: c.cta,
    feature_1_title: c.features[0][0], feature_1_desc: c.features[0][1],
    feature_2_title: c.features[1][0], feature_2_desc: c.features[1][1],
    feature_3_title: c.features[2][0], feature_3_desc: c.features[2][1],
  };
}

function promoMailVars(user) {
  return {
    eyebrow_label: 'LIMITED SPOTS',
    subject_line: 'New internship cohort — spots are filling fast',
    first_name: firstName(user.name),
    body_text: 'Our next DevCraft cohort just opened with fresh projects across AI, Web Development, Cloud and Design. Flexible timelines, mentor support, and a verified certificate at the end. Apply before seats run out.',
    cta_link: APPLY_URL,
    cta_text: 'Apply Now',
    feature_1_title: 'Virtual', feature_1_desc: '100% remote, work from anywhere',
    feature_2_title: 'Mentors', feature_2_desc: 'Industry experts guide your projects',
    feature_3_title: 'Certificate', feature_3_desc: 'Verified & shareable on LinkedIn',
  };
}

// ---------- brevo ----------
async function sendBrevoEmail({ to, toName, subject, html }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to, name: toName || '' }],
      subject,
      htmlContent: html,
      textContent: toText(html),
      replyTo: { email: FROM_EMAIL },
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ---------- send wrapper ----------
let sentToday = 0;
let usageLoaded = false;

function resolveTo(original) {
  if (DRY_RUN) return null;
  if (SANDBOX_EMAIL) return SANDBOX_EMAIL;
  return original;
}

async function trySend({ user, type, category, vars }) {
  const key = encodeKey(user.email);
  const to = resolveTo(user.email);
  const label = `[${type}${category ? ':' + category : ''}]`;
  const subject = vars.subject_line;
  const html = buildHtml(vars);

  if (!to) { console.log(`  ○ ${label} ${user.email} (dry-run)`); sentToday++; return true; }

  if (!usageLoaded) {
    const u = (await get(`${STATE_BASE}/usage`)) || {};
    sentToday = (u.date === todayStr()) ? (u.sent || 0) : 0;
    usageLoaded = true;
  }
  const remaining = BREVO_DAILY_LIMIT - sentToday;
  if (remaining <= 0) { console.log(`  ⏸ quota exhausted (${BREVO_DAILY_LIMIT}/${BREVO_DAILY_LIMIT})`); return false; }

  try {
    await sendBrevoEmail({ to, toName: user.name, subject, html });
    sentToday++;
    await patch(`${STATE_BASE}/usage`, { date: todayStr(), sent: sentToday });
    await patch(`${STATE_BASE}/${type}/${key}`, { email: user.email, name: user.name || '', category: category || '', lastSentAt: new Date().toISOString(), count: (user._count || 0) + 1 });
    console.log(`  ✓ ${label} ${user.email}`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${label} ${user.email}: ${err.message}`);
    await patch(`${STATE_BASE}/failed/${key}`, { email: user.email, type, error: err.message.slice(0, 300), at: new Date().toISOString() });
    return true; // continue with next user
  }
}

// ---------- phase 1: web mails (each 5 days) ----------
async function phaseWebMails(webStates) {
  console.log('\n[Phase 1] Web mails — categories, cooldown 5 days');
  const cats = (await get('emailCategories')) || {};
  let eligible = 0, skipped = 0;

  for (const [category, entries] of Object.entries(cats)) {
    if (!entries || typeof entries !== 'object') continue;
    for (const [key, user] of Object.entries(entries)) {
      const email = user?.email || key.replace(/_/g, '.');
      if (!email.includes('@')) continue;

      const state = webStates[encodeKey(email)] || {};
      if (state.lastSentAt && daysBetween(state.lastSentAt, new Date()) < WEB_MAIL_COOLDOWN_DAYS) {
        skipped++;
        continue;
      }
      eligible++;
      const ok = await trySend({
        user: { email, name: user.name || user.fullName || '', _count: state.count },
        type: 'web',
        category,
        vars: webMailVars(category, user),
      });
      if (!ok) { console.log(`[Phase 1] stopped early — quota reached`); return; }
    }
  }
  console.log(`[Phase 1] done — ${eligible} sent, ${skipped} skipped (< ${WEB_MAIL_COOLDOWN_DAYS}d)`);
}

// ---------- phase 2: promo mails (daily, remaining quota) ----------
async function phasePromoMails(promoStates) {
  console.log('\n[Phase 2] Promo mails — queue users, daily');
  const queue = (await get('queue')) || {};
  let sent = 0, alreadyToday = 0;

  for (const [key, user] of Object.entries(queue)) {
    const email = user?.email || decodeQueueKey(key);
    if (!email || !email.includes('@')) continue;

    const state = promoStates[encodeKey(email)] || {};
    if (state.lastSentAt && state.lastSentAt.slice(0, 10) === todayStr()) {
      alreadyToday++;
      continue;
    }
    const ok = await trySend({
      user: { email, name: user.name || '', _count: state.count },
      type: 'promo',
      vars: promoMailVars(user),
    });
    if (!ok) break;
    sent++;
  }
  console.log(`[Phase 2] done — ${sent} sent, ${alreadyToday} already got promo today`);
}

function decodeQueueKey(key) {
  // keys look like "user@gmail_com" -> restore dots in domain only
  const m = key.match(/^(.+)_([a-z]{2,})$/i);
  if (!m) return key;
  return `${m[1].replace(/_/g, '.')}.${m[2].replace(/_/g, '.')}`;
}

// ---------- main ----------
async function main() {
  console.log(`=== Email Automation ${new Date().toISOString()} ===`);
  if (!IS_PROD && !DRY_RUN && !SANDBOX_EMAIL) {
    console.error('SAFETY: pass --dry-run, set SANDBOX_EMAIL, or NODE_ENV=production');
    process.exit(1);
  }
  if (DRY_RUN) console.log('MODE: DRY RUN — no emails will be sent\n');
  else if (SANDBOX_EMAIL) console.log(`MODE: SANDBOX — all mail -> ${SANDBOX_EMAIL}\n`);
  else console.log('MODE: PRODUCTION\n');

  const [webStates, promoStates] = await Promise.all([
    get(`${STATE_BASE}/web`).then(r => r || {}),
    get(`${STATE_BASE}/promo`).then(r => r || {}),
  ]);

  await phaseWebMails(webStates);
  await phasePromoMails(promoStates);
  console.log(`\n=== Done. Total sends this run: ${sentToday} ===`);
}

main().catch((err) => { console.error('[FATAL]', err); process.exit(1); });

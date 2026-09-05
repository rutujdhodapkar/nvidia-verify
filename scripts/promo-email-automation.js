// DEV/CRAFT Email Automation (Brevo) — plain text emails
// Phase 1: WEB MAILS  -> users under emailCategories/* , once every 5 days
// Phase 2: PROMO MAILS -> queue/* users, daily, from remaining Brevo quota
// Data + state live in portfolio Firebase RTDB.

const FIREBASE_URL = process.env.PORTFOLIO_FIREBASE_URL || 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';
const SITE_URL = process.env.SITE_URL || 'https://devcraft.fennark.xyz';
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

// ---------- plain-text templates ----------
const CATEGORY_CONTENT = {
  login: {
    subject: 'Your DevCraft account is active',
    body: (n) => `Hi ${n},

Your DevCraft account is active. Pick your domain, complete tasks at your pace, and earn a verified completion certificate.

Start here: ${SITE_URL}

— DEV/CRAFT by Fennark`,
    features: '',
  },
  task_completed: {
    subject: 'Great progress — keep it going',
    body: (n) => `Hi ${n},

You've been completing tasks consistently. Keep the momentum going — each completed task brings you closer to your certificate.

Continue here: ${SITE_URL}

— DEV/CRAFT by Fennark`,
  },
  internship_application: {
    subject: 'Your DevCraft application',
    body: (n) => `Hi ${n},

Thanks for applying to the DevCraft virtual internship program. Our team is reviewing applications — complete your profile to speed things up.

Your dashboard: ${SITE_URL}

— DEV/CRAFT by Fennark`,
  },
  payment_success: {
    subject: 'Payment confirmed — you are all set',
    body: (n) => `Hi ${n},

Your payment has been confirmed and your internship track is fully activated. Head to your dashboard to see your task list.

Dashboard: ${SITE_URL}

— DEV/CRAFT by Fennark`,
  },
  welcome: {
    subject: 'Welcome to DevCraft',
    body: (n) => `Hi ${n},

We're excited to have you on board! Your virtual internship dashboard is ready — log in anytime and start with Task 1.

Open dashboard: ${SITE_URL}

— DEV/CRAFT by Fennark`,
  },
  internship_expired: {
    subject: 'Your internship window ended — re-apply anytime',
    body: (n) => `Hi ${n},

Your internship window has closed — but you can re-apply anytime and we'll fast-track your enrollment so you don't lose progress.

Re-apply: ${SITE_URL}

— DEV/CRAFT by Fennark`,
  },
  all_tasks_done_no_payment: {
    subject: 'One step away from your certificate',
    body: (n) => `Hi ${n},

You've completed every task — impressive! Complete the final step on your dashboard to unlock verification and claim your certificate.

Finish up: ${SITE_URL}

— DEV/CRAFT by Fennark`,
  },
};

const DEFAULT_CATEGORY = 'login';

function webMailText(category, user) {
  const c = CATEGORY_CONTENT[category] || CATEGORY_CONTENT[DEFAULT_CATEGORY];
  return { subject: c.subject, text: c.body(firstName(user.name)) };
}

function promoMailText(user) {
  const n = firstName(user.name);
  return {
    subject: 'New internship cohort — spots are filling fast',
    text: `Hi ${n},

Our next DevCraft cohort just opened with fresh projects across AI, Web Development, Cloud and Design.

- 100% virtual, work around college
- Mentor support on every task
- Verified completion certificate

Apply before seats run out: ${APPLY_URL}

— DEV/CRAFT by Fennark`,
  };
}

// ---------- brevo ----------
async function sendBrevoEmail({ to, toName, subject, text }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to, name: toName || '' }],
      subject,
      textContent: text,
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

async function trySend({ user, type, category }) {
  const key = encodeKey(user.email);
  const to = resolveTo(user.email);
  const label = `[${type}${category ? ':' + category : ''}]`;

  let content;
  if (type === 'promo') content = promoMailText(user);
  else content = webMailText(category, user);

  if (!to) { console.log(`  ○ ${label} ${user.email} (dry-run) "${content.subject}"`); sentToday++; return true; }

  if (!usageLoaded) {
    const u = (await get(`${STATE_BASE}/usage`)) || {};
    sentToday = (u.date === todayStr()) ? (u.sent || 0) : 0;
    usageLoaded = true;
  }
  const remaining = BREVO_DAILY_LIMIT - sentToday;
  if (remaining <= 0) { console.log(`  ⏸ quota exhausted (${BREVO_DAILY_LIMIT}/${BREVO_DAILY_LIMIT})`); return false; }

  try {
    await sendBrevoEmail({ to, toName: user.name, subject: content.subject, text: content.text });
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
      const email = user?.email || decodeQueueKey(key);
      if (!email || !email.includes('@')) continue;

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
      });
      if (!ok) { console.log('[Phase 1] stopped early — quota reached'); return; }
    }
  }
  console.log(`[Phase 1] done — ${eligible} eligible, ${skipped} skipped (< ${WEB_MAIL_COOLDOWN_DAYS}d)`);
}

// ---------- phase 2: promo mails (once per user, then move to sent) ----------
async function phasePromoMails(promoStates) {
  console.log('\n[Phase 2] Promo mails — queue users, once then moved to sent');
  const queue = (await get('queue')) || {};
  let sent = 0, alreadySent = 0;

  for (const [key, user] of Object.entries(queue)) {
    const email = user?.email || decodeQueueKey(key);
    if (!email || !email.includes('@')) continue;

    const state = promoStates[encodeKey(email)] || {};
    // If already has a promo send recorded, move to sent and skip
    if (state.lastSentAt) {
      alreadySent++;
      await moveToSent(key, user);
      continue;
    }
    const ok = await trySend({
      user: { email, name: user.name || '', _count: state.count },
      type: 'promo',
    });
    if (!ok) break;
    // After successful send, move to sent bucket
    await moveToSent(key, user);
    sent++;
  }
  console.log(`[Phase 2] done — ${sent} sent, ${alreadySent} already sent (moved to sent)`);
}

async function moveToSent(key, user) {
  const sentRef = `queue/sent/${key}`;
  await patch(sentRef, { ...user, sentAt: new Date().toISOString() });
  // Remove from active queue
  await fb(`queue/${key}`, 'DELETE').catch(() => {});
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

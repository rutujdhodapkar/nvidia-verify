import 'dotenv/config';

const FIREBASE_URL = 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'Support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT Internships';
const DAILY_LIMIT = 300;
const BATCH_SIZE = 10;
const SITE = 'https://devcraft.fennark.xyz';

const templates = [
  {
    subject: 'Your virtual internship is waiting',
    bodyHTML: (name) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333">
<p style="font-size:15px;line-height:1.5">Hi ${name || 'there'},</p>
<p style="font-size:15px;line-height:1.5">DEV/CRAFT is now accepting applications for virtual internships across 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.</p>
<p style="font-size:15px;line-height:1.5">When you apply and enroll, you get an instant offer letter. Then you spend 6 weeks building real, production-grade projects that go straight into your portfolio.</p>
<p style="font-size:15px;line-height:1.5">It takes 2 minutes to apply. No interviews. No waiting.</p>
<p style="font-size:15px;line-height:1.5"><a href="${SITE}" style="color:#1a73e8">Apply now at devcraft.fennark.xyz</a></p>
<p style="font-size:15px;line-height:1.5">Best,<br>The DEV/CRAFT Team</p>
<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
<p style="font-size:12px;color:#888"><a href="#" style="color:#888">Unsubscribe</a></p>
</body>
</html>`,
    bodyText: (name) => `Hi ${name || 'there'},

DEV/CRAFT is now accepting applications for virtual internships across 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, and more.

When you apply and enroll, you get an instant offer letter. Then you spend 6 weeks building real, production-grade projects that go straight into your portfolio.

It takes 2 minutes to apply. No interviews. No waiting.

Apply now: ${SITE}

Best,
The DEV/CRAFT Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
  {
    subject: 'Your offer letter is ready — just apply',
    bodyHTML: (name) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333">
<p style="font-size:15px;line-height:1.5">Hi ${name || 'there'},</p>
<p style="font-size:15px;line-height:1.5">At DEV/CRAFT, the offer letter arrives the moment you enroll. No screening rounds. No waiting for approvals.</p>
<p style="font-size:15px;line-height:1.5">Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, Data Analytics, and more. Each program is 6 weeks, self-paced, and built around projects that teach you real skills.</p>
<p style="font-size:15px;line-height:1.5">Your certificate comes with a live verification link employers can check in seconds.</p>
<p style="font-size:15px;line-height:1.5"><a href="${SITE}" style="color:#1a73e8">Claim your offer letter at devcraft.fennark.xyz</a></p>
<p style="font-size:15px;line-height:1.5">Best,<br>The DEV/CRAFT Team</p>
<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
<p style="font-size:12px;color:#888"><a href="#" style="color:#888">Unsubscribe</a></p>
</body>
</html>`,
    bodyText: (name) => `Hi ${name || 'there'},

At DEV/CRAFT, the offer letter arrives the moment you enroll. No screening rounds. No waiting for approvals.

Choose from 20+ domains — Web Development, Data Science, Cyber Security, Full Stack, UI/UX, Data Analytics, and more. Each program is 6 weeks, self-paced, and built around projects that teach you real skills.

Your certificate comes with a live verification link employers can check in seconds.

Claim your offer letter: ${SITE}

Best,
The DEV/CRAFT Team

---
To unsubscribe, reply with "unsubscribe".`,
  },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getMeta() {
  const res = await fetch(`${FIREBASE_URL}/meta.json`);
  if (res.status === 404) return {};
  const data = await res.json();
  return data || {};
}

async function saveMeta(meta) {
  await fetch(`${FIREBASE_URL}/meta.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  });
}

async function getQueueBatch(limit) {
  const res = await fetch(`${FIREBASE_URL}/queue.json?orderBy="$key"&limitToFirst=${limit}`);
  if (res.status === 404) return {};
  const data = await res.json();
  return data || {};
}

async function sendViaBrevo({ email, name, templateIdx }) {
  const tpl = templates[templateIdx % templates.length];
  const body = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email, name: name || '' }],
    subject: tpl.subject,
    htmlContent: tpl.bodyHTML(name),
    textContent: tpl.bodyText(name),
    replyTo: { email: FROM_EMAIL },
    headers: {
      'List-Unsubscribe': '<mailto:unsubscribe@fennark.xyz?subject=unsubscribe>',
      'X-Priority': '3',
    },
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }

  return res.json();
}

async function moveToSent(queueKey, item, messageId, templateIdx) {
  const sentEntry = {
    name: item.name,
    email: item.email,
    sentAt: new Date().toISOString(),
    messageId,
    template: templateIdx % templates.length,
  };

  const [sentRes, delRes] = await Promise.all([
    fetch(`${FIREBASE_URL}/sent/${queueKey}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sentEntry),
    }),
    fetch(`${FIREBASE_URL}/queue/${queueKey}.json`, {
      method: 'DELETE',
    }),
  ]);

  if (!sentRes.ok || !delRes.ok) {
    const err = await sentRes.text();
    throw new Error(`Firebase move error: ${err}`);
  }
}

async function sendBatch() {
  const meta = await getMeta();
  const today = todayStr();

  if (meta.lastRunDate !== today) {
    meta.dailyCount = 0;
    meta.lastRunDate = today;
  }

  if (meta.dailyCount >= DAILY_LIMIT) {
    return { meta, sent: 0, failed: 0, done: true };
  }

  const remaining = DAILY_LIMIT - meta.dailyCount;
  const batchSize = Math.min(BATCH_SIZE, remaining);

  const queue = await getQueueBatch(batchSize);
  const entries = Object.entries(queue);

  if (entries.length === 0) {
    return { meta, sent: 0, failed: 0, done: true };
  }

  let sent = 0;
  let failed = 0;
  let templateIdx = meta.templateCounter || 0;

  for (const [key, item] of entries) {
    try {
      const result = await sendViaBrevo({ email: item.email, name: item.name, templateIdx });
      await moveToSent(key, item, result.messageId, templateIdx);
      meta.dailyCount = (meta.dailyCount || 0) + 1;
      templateIdx++;
      sent++;
    } catch (err) {
      console.error(`  ✗ ${item.email}: ${err.message}`);
      failed++;
    }
  }

  meta.templateCounter = templateIdx;
  await saveMeta(meta);
  return { meta, sent, failed, done: false };
}

async function main() {
  console.log(`\n=== Email Campaign: ${new Date().toISOString()} ===\n`);

  let totalSent = 0;
  let totalFailed = 0;
  let round = 0;

  while (true) {
    round++;
    const result = await sendBatch();

    totalSent += result.sent;
    totalFailed += result.failed;

    console.log(`  Round ${round}: sent ${result.sent}, failed ${result.failed} (daily ${result.meta.dailyCount}/${DAILY_LIMIT})`);

    if (result.done) break;

    if (result.sent === 0 && result.failed === 0) break;

    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n=== Done: ${totalSent} sent, ${totalFailed} failed ===`);
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });

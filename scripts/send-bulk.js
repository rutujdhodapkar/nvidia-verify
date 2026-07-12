import 'dotenv/config';

const FIREBASE_URL = 'https://portfolio-cfe62-default-rtdb.firebaseio.com';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'Support@fennark.xyz';
const FROM_NAME = 'Team at DEV/CRAFT';
const DAILY_LIMIT = 300;
const BATCH_SIZE = 10;
const SITE = 'https://devcraft.fennark.xyz';

const templates = [
  {
    subject: 'Quick question',
    bodyHTML: (name) => `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;font-size:15px;color:#333;line-height:1.5">
<p>Hi ${name || 'there'},</p>
<p>I was checking our records and noticed you haven't started your virtual internship yet.</p>
<p>DEV/CRAFT has 20+ domains open right now — Web, Data Science, Cyber Security, Full Stack, UI/UX. You apply, get your offer letter instantly, and start building real projects right away.</p>
<p>Takes 2 minutes.</p>
<p><a href="${SITE}" style="color:#1a73e8">devcraft.fennark.xyz</a></p>
<p>Best,<br>The DEV/CRAFT Team</p>
</body>
</html>`,
    bodyText: (name) => `Hi ${name || 'there'},

I was checking our records and noticed you haven't started your virtual internship yet.

DEV/CRAFT has 20+ domains open right now — Web, Data Science, Cyber Security, Full Stack, UI/UX. You apply, get your offer letter instantly, and start building real projects right away.

Takes 2 minutes.

${SITE}

Best,
The DEV/CRAFT Team`,
  },
  {
    subject: 'Just a follow up',
    bodyHTML: (name) => `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;font-size:15px;color:#333;line-height:1.5">
<p>Hi ${name || 'there'},</p>
<p>Quick note — DEV/CRAFT is still accepting applications for virtual internships across 20+ domains.</p>
<p>When you sign up, the offer letter lands in your inbox immediately. Then you pick a domain and start building actual projects you can put on your resume.</p>
<p>All self-paced, fully virtual.</p>
<p><a href="${SITE}" style="color:#1a73e8">devcraft.fennark.xyz</a></p>
<p>Best,<br>The Team</p>
</body>
</html>`,
    bodyText: (name) => `Hi ${name || 'there'},

Quick note — DEV/CRAFT is still accepting applications for virtual internships across 20+ domains.

When you sign up, the offer letter lands in your inbox immediately. Then you pick a domain and start building actual projects you can put on your resume.

All self-paced, fully virtual.

${SITE}

Best,
The Team`,
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
    await fetch(`${FIREBASE_URL}/queue/0_rutujdhodapkar_gmail_com.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Rutuj Dhodapkar', email: 'rutujdhodapkar@gmail.com', addedAt: new Date().toISOString() }),
    });
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
      const retryCount = (item.retryCount || 0) + 1;
      if (retryCount >= 3) {
        await fetch(`${FIREBASE_URL}/failed/${key}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, retryCount, lastError: err.message, failedAt: new Date().toISOString() }),
        });
        await fetch(`${FIREBASE_URL}/queue/${key}.json`, { method: 'DELETE' });
        console.log(`  → Moved to /failed/ after ${retryCount} attempts`);
      } else {
        await fetch(`${FIREBASE_URL}/queue/${key}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ retryCount }),
        });
        console.log(`  → Will retry (attempt ${retryCount}/3)`);
      }
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

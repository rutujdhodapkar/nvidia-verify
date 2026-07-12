import 'dotenv/config';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'Support@fennark.xyz';
const FROM_NAME = 'Fennark Team';

async function sendEmail({ to, subject, htmlContent, textContent, replyTo }) {
  const body = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent,
    replyTo: replyTo ? { email: replyTo } : undefined,
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

const testHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#333">
<p style="font-size:15px;line-height:1.5">Hi there,</p>
<p style="font-size:15px;line-height:1.5">Thanks for being part of the Fennark community. We wanted to personally share what we've been working on — a few updates we think you'll find useful.</p>
<p style="font-size:15px;line-height:1.5">We've made some improvements and added new features based on your feedback. You can check them out anytime at <a href="https://fennark.xyz" style="color:#1a73e8">fennark.xyz</a>.</p>
<p style="font-size:15px;line-height:1.5">If you have any questions, just reply to this email — we read every response.</p>
<p style="font-size:15px;line-height:1.5">Best,<br>The Fennark Team</p>
<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">
<p style="font-size:12px;color:#888">
<a href="#" style="color:#888">Unsubscribe</a>
</p>
</body>
</html>`;

const testText = `Hi there,

Thanks for being part of the Fennark community. We wanted to personally share what we've been working on — a few updates we think you'll find useful.

We've made some improvements and added new features based on your feedback. You can check them out anytime at https://fennark.xyz

If you have any questions, just reply to this email — we read every response.

Best,
The Fennark Team

---
To unsubscribe, reply with "unsubscribe".`;

async function main() {
  const to = process.argv[2];
  if (!to) { console.error('Usage: node scripts/send-promo.js <email>'); process.exit(1); }
  console.log(`Sending to: ${to}`);

  try {
    const result = await sendEmail({
      to,
      subject: 'Quick update from Fennark',
      htmlContent: testHtml,
      textContent: testText,
      replyTo: FROM_EMAIL,
    });
    console.log('Sent! Message ID:', result.messageId);
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

main();

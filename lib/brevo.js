const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';

export async function sendBrevoEmail({ to, toName, subject, htmlContent, textContent }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const body = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: to, name: toName || '' }],
    subject,
    htmlContent,
    textContent: textContent || htmlContent.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n'),
    replyTo: { email: FROM_EMAIL },
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error ${res.status}: ${err}`);
  }
  return res.json();
}

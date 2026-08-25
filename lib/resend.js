import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || 'DEV/CRAFT <onboarding@resend.dev>';
const REPLY_TO = process.env.REPLY_TO_EMAIL || 'support@fennark.xyz';

let client = null;

function getClient() {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set in .env');
  if (!client) client = new Resend(RESEND_API_KEY);
  return client;
}

export async function sendResendEmail({ to, toName, subject, text, html }) {
  const resend = getClient();
  const payload = {
    from: MAIL_FROM,
    to: [to],
    subject,
    reply_to: REPLY_TO,
    text,
  };
  if (toName) payload.headers = { 'X-Legacy-Name': toName };
  if (html) payload.html = html;
  if (!html && text) payload.text = text;

  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
  return { messageId: data.id };
}

export async function verifyResend() {
  try {
    await getClient();
    return true;
  } catch {
    return false;
  }
}

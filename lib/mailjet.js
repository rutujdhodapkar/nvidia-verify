import Mailjet from 'node-mailjet';

let client = null;

export function getClient() {
  if (client) return client;
  const apiKey = process.env.MAILJET_API_KEY;
  const secretKey = process.env.MAILJET_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error('MAILJET_API_KEY and MAILJET_SECRET_KEY must be set');
  client = new Mailjet({ apiKey, apiSecret: secretKey });
  return client;
}

function defaultHeaders() {
  return {
    'List-Unsubscribe': '<mailto:unsubscribe@fennark.xyz?subject=unsubscribe>',
    'X-Mailer': 'DEV/CRAFT-Mailjet/1.0',
  };
}

export async function sendEmail({ to, toName, subject, html, text, fromEmail, fromName, headers }) {
  const mj = getClient();
  const msg = {
    From: { Email: fromEmail || 'support@fennark.xyz', Name: fromName || 'DEV/CRAFT' },
    To: [{ Email: to, Name: toName || '' }],
    Subject: subject,
    HTMLPart: html,
    TextPart: text || (html ? html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n') : ''),
  };
  const merged = { ...defaultHeaders(), ...(headers || {}) };
  if (Object.keys(merged).length > 0) msg.Headers = merged;
  const request = mj.post('send', { version: 'v3.1' }).request({ Messages: [msg] });
  const result = await request;
  return result.body;
}

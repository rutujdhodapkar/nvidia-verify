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

export async function sendEmail({ to, toName, subject, html, text, fromEmail, fromName }) {
  const mj = getClient();
  const request = mj.post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: fromEmail || 'support@fennark.xyz', Name: fromName || 'DEV/CRAFT' },
        To: [{ Email: to, Name: toName || '' }],
        Subject: subject,
        HTMLPart: html,
        TextPart: text || html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n'),
      },
    ],
  });
  const result = await request;
  return result.body;
}

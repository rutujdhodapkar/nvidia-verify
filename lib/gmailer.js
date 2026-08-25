import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Rutuj from DEV/CRAFT';

let transporter = null;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
    });
  }
  return transporter;
}

export async function sendInboxEmail({ to, toName, subject, text }) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: { name: FROM_NAME, address: GMAIL_USER },
    to: toName ? { name: toName, address: to } : { address: to },
    replyTo: GMAIL_USER,
    subject,
    text,
  });
  return { messageId: info.messageId, response: info.response };
}

export async function verifySmtp() {
  const t = getTransporter();
  await t.verify();
  return true;
}

export function gmailAddress() {
  return GMAIL_USER;
}

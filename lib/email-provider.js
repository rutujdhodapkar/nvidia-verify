import { sendBrevoEmail } from './brevo.js';
import { sendEmail as sendMailjetEmail } from './mailjet.js';
import { pfPut, pfGet } from './portfolio-firebase.js';

const MAILJET_DAILY = 200;
const BREVO_DAILY = 300;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getUsage() {
  const meta = await pfGet('meta') || {};
  const today = todayStr();
  if (meta.usageDate !== today) {
    meta.usageDate = today;
    meta.mailjetCount = 0;
    meta.brevoCount = 0;
  }
  return meta;
}

async function saveUsage(meta) {
  await pfPut('meta', meta);
}

export async function getProviderStatus() {
  const meta = await getUsage();
  return {
    mailjet: { used: meta.mailjetCount || 0, limit: MAILJET_DAILY, remaining: MAILJET_DAILY - (meta.mailjetCount || 0) },
    brevo: { used: meta.brevoCount || 0, limit: BREVO_DAILY, remaining: BREVO_DAILY - (meta.brevoCount || 0) },
  };
}

function pickPrimary(status) {
  if (status.mailjet.remaining <= 0 && status.brevo.remaining <= 0) return null;
  if (status.mailjet.remaining <= 0) return 'brevo';
  if (status.brevo.remaining <= 0) return 'mailjet';
  return status.mailjet.remaining >= status.brevo.remaining ? 'mailjet' : 'brevo';
}

function normalizeHeaders(headers) {
  if (!headers || (Array.isArray(headers) && headers.length === 0) || (typeof headers === 'object' && Object.keys(headers).length === 0)) return undefined;
  if (Array.isArray(headers)) return headers;
  return Object.entries(headers).map(([Name, Value]) => ({ Name, Value }));
}

export async function sendEmail({ to, toName, subject, html, text, headers }) {
  const meta = await getUsage();
  const today = todayStr();
  if (meta.usageDate !== today) {
    meta.mailjetCount = 0;
    meta.brevoCount = 0;
    meta.usageDate = today;
  }

  const status = {
    mailjet: { used: meta.mailjetCount || 0, remaining: MAILJET_DAILY - (meta.mailjetCount || 0) },
    brevo: { used: meta.brevoCount || 0, remaining: BREVO_DAILY - (meta.brevoCount || 0) },
  };

  const primary = pickPrimary(status);
  if (!primary) {
    throw new Error('Both Mailjet and Brevo daily limits reached');
  }

  const providers = [primary, primary === 'mailjet' ? 'brevo' : 'mailjet'];

  let lastError = null;
  for (const provider of providers) {
    if (provider === 'mailjet' && status.mailjet.remaining <= 0) {
      lastError = new Error('Mailjet daily limit reached');
      continue;
    }
    if (provider === 'brevo' && status.brevo.remaining <= 0) {
      lastError = new Error('Brevo daily limit reached');
      continue;
    }

    try {
      let result;
      if (provider === 'mailjet') {
        result = await sendMailjetEmail({ to, toName, subject, html, text, fromEmail: undefined, fromName: undefined, headers: normalizeHeaders(headers) });
        meta.mailjetCount = (meta.mailjetCount || 0) + 1;
      } else {
        result = await sendBrevoEmail({ to, toName, subject, htmlContent: html, textContent: text, headers: normalizeHeaders(headers) });
        meta.brevoCount = (meta.brevoCount || 0) + 1;
      }

      await saveUsage(meta);
      return { ...result, provider };
    } catch (err) {
      lastError = err;
      console.warn(`[EmailProvider] ${provider} failed for ${to}: ${err.message}, falling back...`);
    }
  }

  throw lastError || new Error('All email providers failed');
}

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

const disabledProviders = new Set();

function isPermanentError(err) {
  const msg = err.message || '';
  return msg.includes('401') || msg.includes('blocked') || msg.includes('temporarily blocked') || msg.includes('account') && msg.includes('suspended');
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
    disabledProviders.clear();
    meta.mailjetCount = 0;
    meta.brevoCount = 0;
    meta.usageDate = today;
  }

  const providers = ['mailjet', 'brevo'].filter(p =>
    !disabledProviders.has(p) &&
    (p === 'mailjet' ? (MAILJET_DAILY - (meta.mailjetCount || 0)) > 0 : (BREVO_DAILY - (meta.brevoCount || 0)) > 0)
  );

  if (providers.length === 0) {
    if (disabledProviders.size > 0) throw new Error('All providers disabled (permanent failure detected)');
    throw new Error('All email providers daily limit reached');
  }

  let lastError = null;
  for (const provider of providers) {
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
      if (isPermanentError(err)) {
        disabledProviders.add(provider);
        console.warn(`[EmailProvider] ${provider} permanently disabled for this session: ${err.message}`);
      } else {
        console.warn(`[EmailProvider] ${provider} failed for ${to}: ${err.message}, trying next...`);
      }
    }
  }

  throw lastError || new Error('All email providers failed');
}

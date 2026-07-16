const FIREBASE_URL = process.env.FIREBASE_LOGS_URL || 'https://laptop-privacy-default-rtdb.firebaseio.com';

async function fbFetch(path, method = 'GET', body = null) {
  const url = `${FIREBASE_URL}/${path}.json`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Firebase ${method} ${path}: ${res.status} ${await res.text().catch(() => '')}`);
  if (method === 'DELETE') return null;
  return res.json().catch(() => null);
}

export async function fbGet(path) {
  return fbFetch(path, 'GET');
}

export async function fbPut(path, data) {
  return fbFetch(path, 'PUT', data);
}

export async function fbPatch(path, data) {
  return fbFetch(path, 'PATCH', data);
}

export async function fbDelete(path) {
  return fbFetch(path, 'DELETE');
}

export async function fbPush(path, data) {
  const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await fbPut(`${path}/${key}`, data);
  return key;
}

export async function logEmailSend({ email, name, internId, type, subject, status, messageId, error }) {
  const entry = {
    email,
    name: name || '',
    internId: internId || '',
    type,
    subject: subject || '',
    status: status || 'sent',
    messageId: messageId || '',
    error: error || '',
    timestamp: new Date().toISOString(),
  };
  await fbPush('mailjet/logs', entry);
  await fbPatch(`mailjet/by-email/${encodeFirebaseKey(email)}/${type}`, { lastSent: entry.timestamp, count: true });
  await fbPatch(`mailjet/stats/${type}`, { [new Date().toISOString().slice(0, 10)]: true });
  return entry;
}

export async function hasEmailBeenSent({ email, type }) {
  const key = encodeFirebaseKey(email);
  const data = await fbGet(`mailjet/by-email/${key}/${type}`);
  return !!data?.lastSent;
}

export async function getEmailLogs(type, limit = 50) {
  const all = await fbGet('mailjet/logs') || {};
  const entries = Object.values(all).filter(e => !type || e.type === type);
  return entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, limit);
}

export async function analyzeAndStoreEnrollments(enrollments) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    total: enrollments.length,
    withInternId: enrollments.filter(e => e.internId).length,
    withDomain: enrollments.filter(e => e.domain).length,
    withPayment: enrollments.filter(e => e.paymentStatus === 'completed').length,
    completed: enrollments.filter(e => {
      const projects = e.projects || [];
      const subs = e.submissions || {};
      return projects.length > 0 && projects.every((_, i) => subs[i]?.verified);
    }).length,
    needsWelcome: enrollments.filter(e => !e.mailjet?.welcomeSent).length,
    needsOfferLetter: enrollments.filter(e => e.internId && e.domain && !e.mailjet?.offerLetterSent).length,
    needsPayment: enrollments.filter(e => e.paymentStatus === 'completed' && !e.mailjet?.paymentSent).length,
    needsCompletion: enrollments.filter(e => {
      const projects = e.projects || [];
      const subs = e.submissions || {};
      return projects.length > 0 && projects.every((_, i) => subs[i]?.verified) && !e.mailjet?.completionSent;
    }).length,
    updatedAt: new Date().toISOString(),
  };
  await fbPut(`mailjet/analysis/${today}`, summary);
  await fbPut('mailjet/analysis/latest', summary);
  return summary;
}

export async function getEnrollmentCategories(enrollments) {
  const categories = {
    new_signups: [],
    active: [],
    near_completion: [],
    completed: [],
    expired: [],
  };
  const today = new Date();
  for (const e of enrollments) {
    if (!e.email) continue;
    const projects = e.projects || [];
    const subs = e.submissions || {};
    const allVerified = projects.length > 0 && projects.every((_, i) => subs[i]?.verified);
    if (allVerified) { categories.completed.push(e.id); continue; }
    if (e.endDate || e.internshipEndDate) {
      const end = new Date(e.endDate || e.internshipEndDate);
      const daysLeft = Math.floor((end - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) { categories.expired.push(e.id); continue; }
      if (daysLeft <= 7) { categories.near_completion.push(e.id); continue; }
    }
    if (e.internId && e.domain && projects.length > 0) { categories.active.push(e.id); continue; }
    categories.new_signups.push(e.id);
  }
  await fbPut('mailjet/categories', { ...categories, updatedAt: new Date().toISOString() });
  return categories;
}

export async function getSentStatus(email) {
  const key = encodeFirebaseKey(email);
  return fbGet(`mailjet/by-email/${key}`) || {};
}

function encodeFirebaseKey(str) {
  return (str || '').replace(/[.#$\/\[\]]/g, '_');
}

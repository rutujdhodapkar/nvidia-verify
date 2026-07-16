const BLOCKED = new Set([
  'vibhuteonkar588@gmail.com',
  'harshadyadav2122005@gmail.com',
  'atharvajangam159@gmail.com',
  ...(process.env.BLOCKED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
]);

export function isBlocked(email) {
  return BLOCKED.has((email || '').toLowerCase().trim());
}

export function isBlockedAny(field) {
  if (!field) return false;
  if (typeof field === 'string') return isBlocked(field);
  if (Array.isArray(field)) return field.some(isBlocked);
  return false;
}

export function filterBlocked(items, emailField = 'email') {
  return (items || []).filter(item => !isBlocked(item[emailField]));
}

export const BLOCKED_EMAILS = BLOCKED;

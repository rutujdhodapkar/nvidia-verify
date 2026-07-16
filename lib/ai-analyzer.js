const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';

async function callNvidia(prompt, systemPrompt) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY not set');
  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a data analysis assistant. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`NVIDIA API ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
  const content = json.choices?.[0]?.message?.content || '{}';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON in AI response: ${content.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

export async function analyzeEnrollmentsForEmailing(enrollments) {
  const summary = {
    total: enrollments.length,
    withEmail: enrollments.filter(e => e.email).length,
    withInternId: enrollments.filter(e => e.internId).length,
    withDomain: enrollments.filter(e => e.domain).length,
    paid: enrollments.filter(e => e.paymentStatus === 'completed').length,
  };

  const template = `{
  "needsWelcome": [{"id":"...", "email":"...", "name":"..."}],
  "needsOfferLetter": [{"id":"...", "email":"...", "name":"...", "internId":"...", "domain":"..."}],
  "needsPaymentConfirm": [{"id":"...", "email":"...", "name":"...", "internId":"..."}],
  "needsTaskReminder": [{"id":"...", "email":"...", "name":"...", "internId":"...", "pendingCount":0}],
  "needsPreExpiry": [{"id":"...", "email":"...", "name":"...", "internId":"...", "endDate":"..."}],
  "needsCompletion": [{"id":"...", "email":"...", "name":"...", "internId":"..."}],
  "duplicates": ["email1", "email2"],
  "stats": {"total":0,"unique":0,"needingWelcome":0,"needingOffer":0,"needingPayment":0,"needingReminder":0,"needingExpiry":0,"needingCompletion":0}
}`;

  const prompt = `Return ONLY the JSON object (no markdown, no explanations).
Fill this template based on the enrollment data below.
Check mailjet.welcomeSent, mailjet.offerLetterSent, mailjet.paymentSent, mailjet.preExpirySent, mailjet.completionSent, mailjet.lastTaskReminderSentAt fields to determine who needs what.

Template: ${template}

Data: ${JSON.stringify(enrollments.slice(0, 50), null, 2)}`;

  try {
    return await callNvidia(prompt, 'You are a JSON-only data analyzer. Never explain. Never add markdown. Return ONLY a valid JSON object matching the requested structure. No text before or after.');
  } catch (err) {
    console.error('AI analysis failed:', err.message);
    return null;
  }
}

export async function suggestEmailContent(enrollment, emailType) {
  const record = {
    name: enrollment.name || 'Intern',
    domain: enrollment.domain || 'N/A',
    internId: enrollment.internId || 'N/A',
    pendingTasks: (enrollment.projects || []).filter((_, i) => !(enrollment.submissions || {})[i]?.verified).length,
    totalTasks: (enrollment.projects || []).length,
    endDate: enrollment.endDate || enrollment.internshipEndDate || 'N/A',
  };

  const prompt = `Given this intern's data, suggest personalized email content for a "${emailType}" email.
Return JSON: { subjectLine, keyHighlights: string[], callToAction: string, tone: string }
Intern: ${JSON.stringify(record)}`;

  try {
    return await callNvidia(prompt, 'You are a copywriter for an internship platform. Suggest personalized email content as JSON.');
  } catch {
    return null;
  }
}

export async function deduplicateEnrollments(enrollments) {
  const seen = new Map();
  const unique = [];
  const duplicates = [];

  for (const e of enrollments) {
    if (!e.email) { unique.push(e); continue; }
    const key = e.email.toLowerCase().trim();
    if (seen.has(key)) {
      duplicates.push({ kept: seen.get(key).id, duplicate: e.id, email: e.email });
      const existing = seen.get(key);
      const existingProjects = (existing.projects || []).length;
      const newProjects = (e.projects || []).length;
      if (newProjects > existingProjects) {
        const idx = unique.indexOf(existing);
        if (idx !== -1) unique[idx] = e;
        seen.set(key, e);
      }
    } else {
      seen.set(key, e);
      unique.push(e);
    }
  }

  return { unique, duplicates };
}

export async function analyzeLogs(logs) {
  const prompt = `Analyze these email send logs and return JSON: 
{ totalSends, byType: {welcome: N, offerLetter: N, payment: N, taskReminder: N, preExpiry: N, completion: N},
  uniqueRecipients: N, errors: N, mostRecentSend: string, dailyBreakdown: { "2026-07-16": N, ... } }

Logs (last 200): ${JSON.stringify(logs.slice(0, 200), null, 2)}`;

  try {
    return await callNvidia(prompt, 'Analyze email logs and return structured JSON summary.');
  } catch {
    return null;
  }
}

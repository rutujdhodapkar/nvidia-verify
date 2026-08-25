// Promo Email Automation with Brevo
// This script sends web mails every 5 days and promo mails daily from remaining quota
// Uses Brevo as the primary email provider

import { fetch } from 'node:url';

// Configuration
const COSMOS_DB_CONNECTION_STRING = process.env.COSMOS_DB_CONNECTION_STRING;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'support@fennark.xyz';
const FROM_NAME = 'DEV/CRAFT';

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const SANDBOX_EMAIL = process.env.SANDBOX_EMAIL || null;
const IS_PROD = process.env.NODE_ENV === 'production';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysBetween(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

// Web mail template (sent each 5 days)
function webMailTemplate(enrollment, category) {
  const { name, email, internId, domain, paymentAmount } = enrollment;
  const subject = category === 'completed'
    ? 'Your DEV/CRAFT Journey – What\'s Next?'
    : category === 're-enrolled'
      ? 'Welcome Back – Your DEV/CRAFT Internship'
      : 'DEV/CRAFT Internship Update';

  let bodyParts;
  if (category === 'completed') {
    bodyParts = [
      `Hi ${name || 'Intern'}!`,
      '',
      `Congratulations on completing all tasks of your DEV/CRAFT internship. Great work!`,
      '',
      'Your certificate of completion is available. Stay tuned for new opportunities and advanced programs.',
      '',
      'If you\'d like to explore a new internship, simply re-apply and we\'ll fast-track your enrollment.',
      '',
      '---',
      'DEV/CRAFT — VIRTUAL INTERNSHIP PLATFORM BY FENNARK',
      'support@fennark.xyz',
    ];
  } else if (category === 're-enrolled') {
    bodyParts = [
      `Hi ${name || 'Intern'}, welcome back!`,
      '',
      "We're glad to see you again! Your new internship is now active.",
      '',
      internId ? `Intern ID: ${internId}` : '',
      domain ? `Domain: ${domain}` : '',
      '',
      'Check your dashboard for assigned tasks and progress updates.',
      '',
      '---',
      'DEV/CRAFT — VIRTUAL INTERNSHIP PLATFORM BY FENNARK',
      'support@fennark.xyz',
    ];
  } else {
    // active
    bodyParts = [
      `Hi ${name || 'Intern'}!`,
      '',
      'Here\'s your latest internship progress update:',
      '',
      'Keep up the great work! Check your dashboard for detailed task status and submissions.',
      '',
      '---',
      'DEV/CRAFT — VIRTUAL INTERNSHIP PLATFORM BY FENNARK',
      'support@fennark.xyz',
    ];
  }

  return { subject, text: bodyParts.filter(p => p).join('\n') };
}

// Promo mail template
function promoMailTemplate(enrollment) {
  const { name, email, internId, domain } = enrollment;
  const subject = 'New Opportunities – DEV/CRAFT Internship';

  const bodyParts = [
    `Hi ${name || 'Intern'}!`,
    '',
    'We have exciting new internship opportunities launching soon!',
    '',
    'Our next cohort features projects in cutting-edge technologies including AI, Web3, and Cloud Engineering.',
    '',
    'Key highlights:',
    '- Flexible virtual internship format',
    '- Mentorship from industry experts',
    '- Real-world project experience',
    '- Certificate of completion',
    '',
    'Make sure to apply early – spots are limited!',
    '',
    'Apply now: [APPLICATION_LINK]',
    '',
    'Best regards,',
    'The DEV/CRAFT Team',
    'support@fennark.xyz',
  ];

  return { subject, text: bodyParts.join('\n') };
}

export async function sendBrevoEmail({ to, subject, html, text }) {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  
  const body = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: to, name: to || '' }],
    subject,
    htmlContent: html,
    textContent: text || html ? html.replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n') : '',
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

main().catch(console.error);
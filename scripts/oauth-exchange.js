import 'dotenv/config';
import { writeFileSync } from 'fs';

const REDIRECT = 'http://localhost:3000/callback';
const code = process.argv[2];

if (!code || !code.includes('code=')) {
  console.error('Usage: node scripts/oauth-exchange.js "<full redirect url with ?code=...>"');
  process.exit(1);
}

const m = code.match(/code=([^&]+)/);
if (!m) { console.error('No code found in URL'); process.exit(1); }
const authCode = decodeURIComponent(m[1]);

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  code: authCode,
  client_id: process.env.LINKEDIN_CLIENT_ID,
  client_secret: process.env.LINKEDIN_CLIENT_SECRET,
  redirect_uri: REDIRECT,
}).toString();

const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});

const data = await res.json();
if (!res.ok) { console.error('Token error:', JSON.stringify(data)); process.exit(1); }

writeFileSync('.env.page-token.json', JSON.stringify(data, null, 2));
console.log('\n✓ SUCCESS! Org-scoped refresh token obtained.');
console.log(`  refresh_token: ${data.refresh_token}`);
console.log(`  scope: ${data.scope}\n`);
console.log('Add this as the LINKEDIN_REFRESH_TOKEN GitHub secret.\n');

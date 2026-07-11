import 'dotenv/config';
import { createInterface } from 'readline';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
if (!CLIENT_ID || !CLIENT_SECRET) { console.error('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env'); process.exit(1); }

const REDIRECT_URI = 'https://www.linkedin.com/developers/tools/oauth/redirect';
const SCOPES = ['w_member_social', 'rw_organization_admin', 'openid', 'profile'];
const state = Math.random().toString(36).substring(2);

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}`;

console.log(`\n═══ LINKEDIN OAUTH ═══\n`);
console.log('1. Open this URL:');
console.log(`\n${authUrl}\n`);
console.log('2. Log in & authorize the DEV/CRAFT app');
console.log('3. You\'ll be redirected to a LinkedIn page showing "Authorization code"');
console.log('4. COPY the ENTIRE URL from your browser address bar and paste it below\n');

const rl = createInterface({ input: process.stdin, output: process.stdout });
const redirectUrl = await new Promise(resolve => rl.question('Paste URL: ', resolve));
rl.close();

const cbUrl = new URL(redirectUrl);
const code = cbUrl.searchParams.get('code');
if (!code) { console.error('No code in URL'); process.exit(1); }

const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString(),
});

const data = await tokenRes.json();
if (!tokenRes.ok) { console.error('Error:', JSON.stringify(data)); process.exit(1); }

console.log(`\n═══ ADD TO GITHUB SECRETS ═══\n`);
console.log(`LINKEDIN_REFRESH_TOKEN=${data.refresh_token}`);

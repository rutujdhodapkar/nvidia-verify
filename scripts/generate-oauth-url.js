import 'dotenv/config';
import { writeFileSync } from 'fs';
import crypto from 'crypto';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || '777c3ev3udb0o2';
const REDIRECT = 'http://localhost:3000/callback';
const SCOPES = 'w_member_social w_organization_social rw_organization_admin openid profile email';
const state = crypto.randomBytes(8).toString('hex');

const authUrl = `https://www.linkedin.com/oauth/v2/authorization` +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&state=${state}`;

console.log('\n═══ LINKEDIN OAUTH URL ═══\n');
console.log('Step 1: Add this exact redirect URI to your LinkedIn app\'s Auth settings:');
console.log('  Go to https://www.linkedin.com/developers/apps/777c3ev3udb0o2/auth');
console.log(`  Add: ${REDIRECT}\n`);
console.log('Step 2: Open this URL in your browser:');
console.log(`  ${authUrl}\n`);
console.log('Step 3: Authorize — look for "w_organization_social" scope in the consent screen.');
console.log('  If it\'s NOT shown, your app needs Marketing Developer Platform approval:');
console.log('  https://www.linkedin.com/developers/apps/777c3ev3udb0o2/products\n');
console.log('Step 4: You\'ll be redirected to localhost:3000/callback?code=...\n');
console.log('Step 5: Run: node scripts/oauth-local.js');
console.log('  (it starts a local server on port 3000 to catch the callback)\n');

writeFileSync('.oauth-url.txt', authUrl);
console.log('URL also saved to .oauth-url.txt');

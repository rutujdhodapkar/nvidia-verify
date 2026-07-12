import 'dotenv/config';
import crypto from 'crypto';

const REDIRECT = 'http://localhost:3000/callback';
const SCOPES = 'w_member_social w_organization_social rw_organization_admin openid profile';
const state = crypto.randomBytes(8).toString('hex');

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent(SCOPES)}&state=${state}`;

console.log('\n═══ LINKEDIN PAGE OAUTH ═══\n');
console.log('Open this URL and authorize:\n');
console.log(authUrl);
console.log('\nAfter authorizing, your browser will try to load localhost:3000 (will show "can\'t connect" — that\'s fine).');
console.log('Copy the FULL address bar URL (it contains ?code=...) and paste it back here.\n');
console.log(`Expected state: ${state}\n`);

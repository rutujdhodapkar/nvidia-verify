import 'dotenv/config';
import { createServer } from 'http';
import { randomBytes } from 'crypto';
import { URL } from 'url';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';
const SCOPES = ['w_member_social', 'r_liteprofile', 'r_emailaddress', 'rw_organization_admin'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log('Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}`;

console.log('\n═══════════════════════════════════════════════');
console.log('  LINKEDIN OAUTH — ONE-TIME SETUP');
console.log('═══════════════════════════════════════════════\n');
console.log('Step 1: Open this URL in your browser and authorize:');
console.log(`\n  ${authUrl}\n`);
console.log('(A local server will catch the callback automatically)\n');

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  if (!code || returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h2>Auth failed — state mismatch or missing code</h2>');
    return;
  }

  try {
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

    if (!tokenRes.ok) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<h2>Error:</h2><pre>${JSON.stringify(data, null, 2)}</pre>`);
      return;
    }

    const output = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      scope: data.scope,
    };

    console.log('\n═══════════════════════════════════════════════');
    console.log('  SUCCESS! Add these to GitHub Secrets:');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`LINKEDIN_REFRESH_TOKEN=${output.refresh_token}`);
    console.log(`LINKEDIN_ACCESS_TOKEN=${output.access_token}`);
    console.log(`\n(ACCESS_TOKEN expires in ${output.expires_in}s, but REFRESH_TOKEN is long-lived)\n`);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>✓ Authorized! Check your terminal.</h2>`);

    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${err.message}</h2>`);
  }
});

server.listen(3001, () => {
  console.log('Step 2: Waiting for the OAuth callback on http://localhost:3001/callback ...\n');
});

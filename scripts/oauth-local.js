import 'dotenv/config';
import http from 'http';
import { URL } from 'url';
import { writeFileSync } from 'fs';
import crypto from 'crypto';

const PORT = 3000;
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPES = 'w_member_social w_organization_social rw_organization_admin openid profile';

const state = crypto.randomBytes(8).toString('hex');
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&scope=${encodeURIComponent(SCOPES)}&state=${state}`;

console.log('\n═══ LINKEDIN PAGE OAUTH ═══\n');
console.log('1. Add this redirect URI to your LinkedIn app Auth settings:');
console.log(`   ${REDIRECT}\n`);
console.log('2. Open this URL in your browser and authorize:');
console.log(`   ${authUrl}\n`);
console.log('3. You will be redirected to localhost — the server captures the code automatically.\n');

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    if (u.pathname !== '/callback') { res.end('Not found'); return; }

    const code = u.searchParams.get('code');
    const err = u.searchParams.get('error');
    if (err) { res.end(`Error: ${err}`); console.error('OAuth error:', err); server.close(); return; }

    const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT }).toString();
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      res.end(`Token error: ${JSON.stringify(data)}`);
      console.error('Token error:', JSON.stringify(data));
      server.close();
      return;
    }

    writeFileSync('.env.local-oauth.json', JSON.stringify(data, null, 2));
    console.log('\n✓ SUCCESS! Refresh token obtained with org scope.');
    console.log(`  refresh_token: ${data.refresh_token}`);
    console.log(`  scope: ${data.scope}`);
    console.log('\nAdd this as LINKEDIN_REFRESH_TOKEN secret in GitHub.\n');

    res.end('<h2>✓ Success!</h2><p>You can close this tab. Check the terminal for your refresh token.</p>');
    server.close();
  } catch (err) {
    res.end(`Server error: ${err.message}`);
    console.error(err);
    server.close();
  }
});

server.listen(PORT, () => console.log(`Local OAuth server listening on port ${PORT}...`));

import 'dotenv/config';
import { createInterface } from 'readline';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'w_organization_social rw_organization_admin openid profile email';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET in .env');
  process.exit(1);
}

const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=devcraft123`;

console.log(`

╔══════════════════════════════════════════════════════════════╗
║  Get LinkedIn Token with w_organization_social scope        ║
╚══════════════════════════════════════════════════════════════╝

STEP 1: Visit this URL in your browser:
${authUrl}

STEP 2: Log in and authorize the app (select your company page if asked)

STEP 3: After authorizing, you'll be redirected to a URL like:
  ${REDIRECT_URI}?code=XXXXX&state=devcraft123

STEP 4: Copy that FULL redirect URL and paste it below

`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the full redirect URL: ', async (url) => {
  rl.close();
  try {
    const code = new URL(url).searchParams.get('code');
    if (!code) { console.error('No authorization code found in URL'); process.exit(1); }

    console.log('\nExchanging code for tokens...');
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Token exchange failed: ${err}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`\n✅ Access token: ${data.access_token?.slice(0, 50)}...`);
    console.log(`✅ Refresh token: ${data.refresh_token?.slice(0, 50)}...`);
    console.log(`✅ Expires in: ${data.expires_in}s`);

    if (data.refresh_token) {
      console.log(`\n📝 Add this to your .env:\nLINKEDIN_REFRESH_TOKEN=${data.refresh_token}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
});

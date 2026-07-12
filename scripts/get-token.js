import 'dotenv/config';

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = 'w_organization_social rw_organization_admin openid profile email';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET in .env');
  process.exit(1);
}

const code = process.argv[2];
if (!code) {
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&state=devcraft123`;
  console.log(`
  Open this URL in your browser:
  ${authUrl}
  
  Log in and when LinkedIn asks "What do you want to manage?"
  you MUST select "DevCraft Internships" (your company page).
  
  After authorizing, you'll be redirected to:
  http://localhost:3456/callback?code=XXXX&state=devcraft123
  
  Copy the 'code' parameter from the URL and run:
  node scripts/get-token.js <CODE>
  `);
  process.exit(0);
}

console.log('Exchanging code for tokens...');

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
  console.error(`Token exchange failed ${res.status}: ${err}`);
  process.exit(1);
}

const data = await res.json();
const refreshToken = data.refresh_token;
const accessToken = data.access_token;

console.log(`✅ Access token: ${accessToken?.slice(0, 50)}...`);

// Look up org
const vanityRes = await fetch('https://api.linkedin.com/v2/organizations?q=vanityName&vanityName=devcraft-internships', {
  headers: { Authorization: `Bearer ${accessToken}` }
});
if (vanityRes.ok) {
  const orgData = await vanityRes.json();
  const orgId = orgData?.elements?.[0]?.id || 'N/A';
  console.log(`✅ Org URN: ${orgId !== 'N/A' ? `urn:li:organization:${orgId}` : 'N/A'}`);
} else {
  const err = await vanityRes.text();
  console.log(`⚠️ Org lookup failed: ${err.slice(0, 150)}`);
}

if (refreshToken) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📝 UPDATE YOUR .env AND GitHub Secret:`);
  console.log(`\nLINKEDIN_REFRESH_TOKEN=${refreshToken}`);
  console.log(`\n${'='.repeat(50)}`);
} else {
  console.log('No refresh token in response');
}

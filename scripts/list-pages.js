import 'dotenv/config';

async function getOrgs() {
  const { LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN } = process.env;
  if (!LINKEDIN_REFRESH_TOKEN) { console.error('Set LINKEDIN_REFRESH_TOKEN in .env'); process.exit(1); }

  const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: LINKEDIN_REFRESH_TOKEN, client_id: LINKEDIN_CLIENT_ID, client_secret: LINKEDIN_CLIENT_SECRET }).toString(),
  });
  const data = await tokenRes.json();
  if (!tokenRes.ok) { console.error('Token error:', JSON.stringify(data)); process.exit(1); }

  const headers = { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' };

  const orgRes = await fetch('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR', { headers });
  const orgs = await orgRes.json();

  if (!orgRes.ok) { console.error('Failed to fetch organizations:', JSON.stringify(orgs)); process.exit(1); }

  if (!orgs.elements?.length) {
    console.log('\nNo organizations found. You may need to re-run get-token.js with rw_organization_admin scope.\n');
    process.exit(0);
  }

  console.log(`\n═══ Your LinkedIn Pages ═══\n`);
  for (const el of orgs.elements) {
    const orgId = el.organizationalTarget.replace('urn:li:organization:', '');
    console.log(`  Name: (fetching...)`);
    console.log(`  URN: ${el.organizationalTarget}`);
    console.log(`  Page ID: ${orgId}`);
    console.log(`  Set LINKEDIN_PAGE_ID=${orgId} in .env / secrets\n`);
  }
}

getOrgs().catch(console.error);

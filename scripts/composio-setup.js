import 'dotenv/config';

const COMPOSIO_API_KEY = 'ak_a7FhWP8nbXN9eS17BpgF';
const BASE = 'https://backend.composio.dev/api/v3.1';
const USER_ID = 'rutuj';

const apps = [
  { name: 'canva', authConfigId: 'ac_mll6hSAIWJJ4', managed: true },
  { name: 'linkedin', authConfigId: 'ac_ogyc3IcPd48F', managed: false },
  { name: 'figma', authConfigId: 'ac_Bvb7ZS_Xc8h7', managed: true },
];

async function createLink(app) {
  const body = {
    auth_config_id: app.authConfigId,
    user_id: USER_ID,
    callback_url: 'https://devcraft.fennark.xyz/connected',
  };

  if (app.managed) {
    // Composio-managed OAuth -> use link() endpoint
    const res = await fetch(`${BASE}/connected_accounts/link`, {
      method: 'POST',
      headers: { 'x-api-key': COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${app.name}: ${res.status} ${text}`);
    return JSON.parse(text);
  } else {
    // Custom auth -> use initiate() endpoint (v3)
    const res = await fetch(`${BASE}/../v3/connected_accounts`, {
      method: 'POST',
      headers: { 'x-api-key': COMPOSIO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_config: { id: app.authConfigId },
        connection: { user_id: USER_ID, callback_url: 'https://devcraft.fennark.xyz/connected' },
      }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${app.name}: ${res.status} ${text}`);
    return JSON.parse(text);
  }
}

for (const app of apps) {
  console.log(`\n=== ${app.name} ===`);
  try {
    const result = await createLink(app);
    const redirectUrl = result?.redirect_url || result?.redirectUrl;
    const connectedAccountId = result?.connected_account_id || result?.id;
    console.log(`Connected Account ID: ${connectedAccountId}`);
    if (redirectUrl) {
      console.log(`Open to connect: ${redirectUrl}`);
    } else {
      console.log('Created (check dashboard)');
    }
  } catch (err) {
    console.error(`Failed: ${err.message}`);
  }
}

const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');

  const siteUrl = 'https://devcraft.fennark.xyz';

  const instructions = imageUrl
    ? `Create a share update on company page devcraft-internships (company ID: ${pageId || '134233993'}). Text: "${content.slice(0, 2000)}". Image URL: ${imageUrl}. Preview link URL: ${siteUrl}. Title: "DEV/CRAFT Virtual Internship". Description: "100% Free Virtual Internship Program for College Students". Visibility: anyone.`
    : `Create a share update on company page devcraft-internships (company ID: ${pageId || '134233993'}). Text: "${content.slice(0, 2000)}". Visibility: anyone.`;

  const result = await callZapier(zapierToken, {
    selected_api: 'LinkedInCLIAPI',
    action: 'share',
    instructions,
    output: 'post_url',
    params: {
      company_id: pageId || '134233993',
    },
  });

  const postUrl = result?.results;
  console.log(`[POST] ✓ Posted to LinkedIn Page${postUrl ? ': ' + postUrl : ''}`);
  return postUrl;
}

async function callZapier(token, args) {
  const res = await fetch(MCP_URL + '?token=' + encodeURIComponent(token), {
    method: 'POST',
    headers: { 'Accept': 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', id: 1, params: { name: 'execute_zapier_write_action', arguments: args } }),
  });

  const txt = await res.text();
  const match = txt.match(/data: (.+)/);
  if (!match) throw new Error('Zapier API error: ' + txt.slice(0, 200));

  const data = JSON.parse(match[1]);
  if (data.error) throw new Error('Zapier error: ' + JSON.stringify(data.error));

  const textContent = data.result?.content?.[0]?.text;
  if (!textContent) throw new Error('Zapier: empty response');

  return JSON.parse(textContent);
}

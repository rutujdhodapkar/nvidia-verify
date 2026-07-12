const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageBuffer, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');

  const result = await callZapier(zapierToken, {
    selected_api: 'LinkedInCLIAPI',
    action: 'create_company_update',
    instructions: `Post to LinkedIn company page devcraft-internships`,
    output: 'post_url',
    params: {
      company_id: pageId || '134233993',
      comment: content,
    },
  });

  const postUrl = result?.results;
  console.log(`[POST] ✓ Posted to LinkedIn Page: ${postUrl || 'success'}`);
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

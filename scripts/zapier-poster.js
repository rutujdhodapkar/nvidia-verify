const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');

  const instructions = imageUrl
    ? `Post to LinkedIn company page devcraft-internships (ID: ${pageId || '134233993'}). Text: "${content}". Include this image URL as the main post media: ${imageUrl}. Upload this image to LinkedIn, then create the post with the image attached. The image is a 1200x630 PNG banner.`
    : `Post to LinkedIn company page devcraft-internships`;

  const result = await callZapier(zapierToken, {
    selected_api: 'LinkedInCLIAPI',
    action: 'create_company_update',
    instructions,
    output: 'post_url',
    params: {
      company_id: pageId || '134233993',
      comment: content,
    },
  });

  const postUrl = result?.results || result?.execution?.url;
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

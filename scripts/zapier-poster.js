const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');
  const pid = pageId || '134233993';

  const paramSets = [
    { company_id: pid, comment: content, content__submitted_image_url: imageUrl },
    { company_id: pid, comment: content, image_url: imageUrl },
    { company_id: pid, comment: content, submitted_image_url: imageUrl },
    { company_id: pid, comment: content, media_url: imageUrl },
    { company_id: pid, comment: content, content_url: imageUrl },
  ];

  let lastErr;
  for (const params of paramSets) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await callZapier(zapierToken, {
          selected_api: 'LinkedInCLIAPI',
          action: 'create_company_update',
          instructions: 'Post to devcraft-internships company page',
          output: 'post_url',
          params,
        });
        const postUrl = r?.results?.post_url || r?.results;
        console.log(`[POST] ✓ Company page: ${postUrl || 'success'}`);
        return postUrl;
      } catch (err) {
        lastErr = err;
        console.log(`[POST] Attempt failed: ${err.message.slice(0, 100)}`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
  throw new Error(`Post failed after retries: ${lastErr?.message}`);
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

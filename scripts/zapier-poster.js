const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');
  const pid = pageId || '134233993';

  const params = {
    company_id: pid,
    comment: content,
    content_url: 'https://devcraft.fennark.xyz',
    content_title: 'DEV/CRAFT Virtual Internship',
    content_description: 'Self-paced, virtual. Build real skills. Get certified.',
    content__submitted_image_url: imageUrl,
  };

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await callZapier(zapierToken, {
        selected_api: 'LinkedInCLIAPI',
        action: 'create_company_update',
        instructions: 'Post to devcraft-internships company page with image thumbnail',
        output: 'post_url',
        params,
      });
      if (result?.error) {
        throw new Error(`Zapier action error: ${result.error}${result.hint ? ' — ' + result.hint : ''}`);
      }
      console.log(`[POST] ✓ Zapier response: ${JSON.stringify(result).slice(0, 300)}`);
      const postUrl = result?.post_url || result?.url || result?.id || JSON.stringify(result);
      console.log(`[POST] ✓ Company page: ${postUrl}`);
      return postUrl;
    } catch (err) {
      lastErr = err;
      console.log(`[POST] Attempt ${attempt + 1} failed: ${err.message.slice(0, 200)}`);
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
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
  if (!match) {
    console.log(`[ZAPIER RAW] ${txt.slice(0, 300)}`);
    throw new Error('Zapier API error: ' + txt.slice(0, 200));
  }

  const data = JSON.parse(match[1]);
  if (data.error) throw new Error('Zapier error: ' + JSON.stringify(data.error));

  const textContent = data.result?.content?.[0]?.text;
  if (!textContent) {
    console.log(`[ZAPIER DATA] ${JSON.stringify(data).slice(0, 300)}`);
    throw new Error('Zapier: empty response');
  }

  return JSON.parse(textContent);
}

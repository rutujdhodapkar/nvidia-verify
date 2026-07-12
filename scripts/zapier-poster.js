const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');
  const pid = pageId || '134233993';

  // Always post text to COMPANY page (with image if available)
  const companyParams = { company_id: pid, comment: content };
  if (imageUrl) companyParams.content__submitted_image_url = imageUrl;

  const r1 = await callZapier(zapierToken, {
    selected_api: 'LinkedInCLIAPI',
    action: 'create_company_update',
    instructions: 'Post to devcraft-internships',
    output: 'post_url',
    params: companyParams,
  });
  const url1 = r1?.results || r1?.results?.post_url;
  console.log(`[POST] ✓ Company page: ${url1 || 'success'}`);

  // If image available, also post to personal profile with image (no link preview)
  if (imageUrl) {
    try {
      const r2 = await callZapier(zapierToken, {
        selected_api: 'LinkedInCLIAPI',
        action: 'share',
        instructions: 'Post to personal profile with this image as post media. No link needed.',
        output: 'post_url',
        params: {
          comment: content,
          content__submitted_image_url: imageUrl,
        },
      });
      const url2 = r2?.results?.post_url || r2?.results;
      console.log(`[POST] ✓ Personal profile with image: ${url2 || 'success'}`);
    } catch (e) {
      console.log(`[POST] Personal image post skipped: ${e.message}`);
    }
  }

  return url1;
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

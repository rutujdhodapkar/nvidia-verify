const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');
  const pid = pageId || '134233993';

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const params = {
        company_id: pid,
        comment: content,
      };

      const instructions = `Immediately create a LinkedIn company page update on DevCraft (page ID ${pid}). Post the EXACT comment text provided in params.comment. Do NOT ask any questions — all information is provided. Proceed and return the post URL.`;

      const result = await callZapier(zapierToken, {
        selected_api: 'LinkedInCLIAPI',
        action: 'create_company_update',
        instructions,
        output: 'post_url',
        params,
      });
      if (result?.error) {
        throw new Error(`Zapier action error: ${result.error}${result.hint ? ' — ' + result.hint : ''}`);
      }
      if (result?.followUpQuestion) {
        throw new Error(`Zapier needs more info: ${result.followUpQuestion.slice(0, 200)}`);
      }
      console.log(`[POST] ✓ Zapier response: ${JSON.stringify(result).slice(0, 300)}`);
      const postUrl = result?.post_url || result?.url || result?.id || result?.results?.post_url || result?.results;
      if (!postUrl) throw new Error(`No post URL in response: ${JSON.stringify(result).slice(0, 200)}`);
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
  const data = parseSse(txt);
  if (!data) {
    console.log(`[ZAPIER RAW] ${txt.slice(0, 300)}`);
    throw new Error('Zapier API error: ' + txt.slice(0, 200));
  }

  if (data.error) throw new Error('Zapier error: ' + JSON.stringify(data.error));

  const textContent = data.result?.content?.[0]?.text;
  if (!textContent) {
    console.log(`[ZAPIER DATA] ${JSON.stringify(data).slice(0, 300)}`);
    throw new Error('Zapier: empty response');
  }

  const isError = data.result?.isError === true;
  if (isError || /^MCP error/i.test(textContent) || /^error:/i.test(textContent)) {
    throw new Error('Zapier MCP error: ' + textContent.slice(0, 500));
  }

  try {
    return JSON.parse(textContent);
  } catch (e) {
    console.log(`[ZAPIER NON-JSON] ${textContent.slice(0, 300)}`);
    throw new Error('Zapier returned non-JSON response: ' + textContent.slice(0, 300));
  }
}

function parseSse(txt) {
  let last = null;
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^data:\s?(.*)$/);
    if (!m) continue;
    const payload = m[1];
    if (payload === '[DONE]') continue;
    try {
      last = JSON.parse(payload);
    } catch { /* skip non-JSON keepalive/comment lines */ }
  }
  return last;
}

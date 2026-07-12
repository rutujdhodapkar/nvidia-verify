const MCP_URL = 'https://mcp.zapier.com/api/v1/connect';

export async function postToLinkedinPage({ content, imageUrl, zapierToken, pageId }) {
  if (!zapierToken) throw new Error('Missing ZAPIER_TOKEN');
  const pid = pageId || '134233993';

  const companyParams = { company_id: pid, comment: content };
  if (imageUrl) companyParams.content__submitted_image_url = imageUrl;

  const r = await callZapier(zapierToken, {
    selected_api: 'LinkedInCLIAPI',
    action: 'create_company_update',
    instructions: 'Post to devcraft-internships company page',
    output: 'post_url',
    params: companyParams,
  });
  const postUrl = r?.results?.post_url || r?.results;
  console.log(`[POST] ✓ Company page: ${postUrl || 'success'}`);
  return postUrl;
}

export async function createCanvaDesign(zapierToken, designBrief, templateId) {
  if (!designBrief || !templateId) {
    console.log('[CANVA] No design brief or template ID, skipping');
    return null;
  }

  const slideText = {};
  if (Array.isArray(designBrief.slides)) {
    designBrief.slides.forEach((s, i) => {
      slideText[`slide_${s.slide_number || i + 1}_headline`] = s.headline || '';
      slideText[`slide_${s.slide_number || i + 1}_subtext`] = s.subtext || '';
    });
  }

  try {
    const r = await callZapier(zapierToken, {
      selected_api: 'Canva',
      action: 'create_design',
      instructions: `Create a ${designBrief.tone || 'clean'} design for LinkedIn post. Primary color: ${designBrief.primary_color || '#6366f1'}.`,
      output: 'design_url',
      params: {
        template_id: templateId,
        title: designBrief.slides?.[0]?.headline || 'DevCraft LinkedIn Post',
        ...slideText,
      },
    });
    const designUrl = r?.results?.url || r?.results?.design_url || r?.results;
    console.log(`[CANVA] ✓ Design created: ${designUrl || 'success'}`);
    return designUrl || null;
  } catch (e) {
    console.log(`[CANVA] Design creation failed: ${e.message}`);
    return null;
  }
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

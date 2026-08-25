// Minimal Zapier MCP client — posts to LinkedIn through mcp.zapier.com
// Requires the LinkedIn action connected in your Zapier MCP config (mcp.zapier.com).

const MCP_URL = process.env.ZAPIER_MCP_URL || 'https://mcp.zapier.com/api/mcp/mcp';

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
}

// Response may be raw JSON or SSE ("data: {...}" lines) — handle both.
async function parseMcpResponse(res) {
  const raw = await res.text();
  if (!res.ok) throw new Error(`Zapier MCP ${res.status}: ${raw.slice(0, 300)}`);
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  const dataLine = trimmed.split('\n').reverse().find(l => l.startsWith('data:'));
  if (!dataLine) throw new Error(`Unexpected MCP response: ${raw.slice(0, 300)}`);
  return JSON.parse(dataLine.slice(5).trim());
}

async function rpc(token, body) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  // Notifications return 202 with empty body
  if (res.status === 202 || res.headers.get('content-length') === '0') return null;
  return parseMcpResponse(res);
}

let sessionId = null;

async function initSession(token) {
  const h = { ...headers(token) };
  if (sessionId) h['Mcp-Session-Id'] = sessionId;

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'devcraft-automation', version: '1.0.0' },
      },
    }),
  });

  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const initResult = await parseMcpResponse(res);

  // Notify server we're ready (ignore errors — some servers don't require it)
  try {
    await rpc(token, { jsonrpc: '2.0', method: 'notifications/initialized' });
  } catch { /* non-fatal */ }

  return initResult;
}

export async function listTools(token) {
  await initSession(token);
  const result = await rpc(token, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  return result?.result?.tools || [];
}

function pickLinkedinTool(tools) {
  const candidates = tools.filter(t => /linkedin/i.test(t.name));
  if (candidates.length === 0) {
    throw new Error(`No LinkedIn tool found. Available: ${tools.map(t => t.name).join(', ')}`);
  }
  return candidates.find(t => /post|share|create|update/i.test(t.name)) || candidates[0];
}

let toolsCache = null;
async function listToolsCached(token) {
  if (!toolsCache) toolsCache = await listTools(token);
  return toolsCache;
}

export async function postToLinkedinViaZapier({ token, text, pageId }) {
  if (!token) throw new Error('ZAPIER_TOKEN not set');

  const tools = await listToolsCached(token);
  const tool = pickLinkedinTool(tools);
  console.log(`      Using Zapier tool: ${tool.name}`);

  // Resolve company_id explicitly: pageId secret -> dynamic enum lookup -> known fallback
  let companyId = pageId && String(pageId).trim() ? String(pageId).trim() : null;
  if (!companyId) {
    const options = await callDynamicEnumValues(token, tool.name, 'company_id').catch(() => null);
    if (Array.isArray(options) && options.length > 0) {
      companyId = typeof options[0] === 'string' ? options[0] : (options[0]?.value ?? options[0]?.id ?? null);
      if (companyId) console.log(`      company_id resolved via list_dynamic_enum_values`);
    }
  }
  if (!companyId) {
    companyId = '134233993'; // devcraft-internships page (matches linkedin-poster.js)
    console.log(`      company_id unresolved — using fallback: ${companyId}`);
  }

  const args = { comment: text, company_id: companyId };

  const result = await rpc(token, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: tool.name, arguments: args },
  });

  if (result?.error) throw new Error(`Zapier tool error: ${JSON.stringify(result.error).slice(0, 300)}`);

  const rawText = Array.isArray(result?.result?.content)
    ? result.result.content.map(c => c.text || '').join(' ')
    : '';
  let inner = null;
  try { inner = JSON.parse(rawText); } catch { /* plain text result */ }

  if (inner?.isError || result?.result?.isError) {
    throw new Error(`Zapier action failed: ${(inner?.error || rawText).slice(0, 300)}`);
  }

  console.log(`[POST] ✓ Via Zapier MCP (${tool.name})`);
  return { ok: true, detail: rawText.slice(0, 200), toolName: tool.name };
}

// The error hint says exactly which helper to use — call it directly.
async function callDynamicEnumValues(token, toolName, propName) {
  const shapes = [
    { tool_name: toolName, property_name: propName },
    { tool_name: toolName, param: propName },
    { tool_name: toolName, field: propName },
    { action: toolName, field: propName },
  ];
  for (const enumArgs of shapes) {
    const result = await rpc(token, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'list_dynamic_enum_values', arguments: enumArgs },
    });
    if (result?.error) continue;
    const rawText = Array.isArray(result?.result?.content)
      ? result.result.content.map(c => c.text || '').join('')
      : '';
    try {
      const parsed = JSON.parse(rawText);
      const arr = Array.isArray(parsed) ? parsed : parsed?.data || parsed?.values;
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch { /* try next shape */ }
  }
  return null;
}


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

// Zapier MCP exposes dynamic enum options through a helper tool.
async function resolveDynamicEnum(token, propName) {
  const tools = await listToolsCached(token);
  const enumTool = tools.find(t => /dynamic.?enum/i.test(t.name))
    || tools.find(t => /list.*(values|options)/i.test(t.name));
  if (!enumTool) return null;
  const result = await rpc(token, {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: enumTool.name, arguments: {} },
  });
  if (result?.error) return null;
  // Result shape varies; extract array of {value,label} or plain values
  const content = result?.result?.content;
  const textVal = Array.isArray(content) ? content.map(c => c.text || '').join('') : '';
  try {
    const parsed = JSON.parse(textVal);
    return Array.isArray(parsed) ? parsed : parsed?.data || null;
  } catch {
    return textVal ? [{ value: textVal.trim(), label: textVal.trim() }] : null;
  }
}

const ARG_TEXT_FIELDS = ['comment', 'text', 'commentary', 'content', 'message', 'body', 'update'];

function buildArgs(tool, text, resolvedEnums) {
  const props = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];
  const args = {};

  for (const [name, spec] of Object.entries(props)) {
    const isRequired = required.includes(name);
    const enumOptions = resolvedEnums?.[name];

    if (spec?.type === 'string' || spec?.anyOf || spec?.enum) {
      if (ARG_TEXT_FIELDS.includes(name)) { args[name] = text; continue; }
      if (Array.isArray(enumOptions) && enumOptions.length > 0) {
        args[name] = typeof enumOptions[0] === 'string' ? enumOptions[0] : enumOptions[0]?.value;
        continue;
      }
      if (isRequired) args[name] = process.env[`ZAPIER_${name.toUpperCase()}`] || '';
    } else if (isRequired && !args[name]) {
      args[name] = '';
    }
  }
  return args;
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

  // Resolve dynamic enums (e.g. company_id) — prefer provided pageId
  const props = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];
  const resolvedEnums = {};
  for (const name of required.filter(n => !ARG_TEXT_FIELDS.includes(n))) {
    if (name === 'company_id' && pageId) { resolvedEnums[name] = [{ value: pageId }]; continue; }
    const options = await resolveDynamicEnum(token, name).catch(() => null);
    if (options) resolvedEnums[name] = options;
  }
  if (!resolvedEnums.company_id && required.includes('company_id') && pageId) {
    resolvedEnums.company_id = [{ value: pageId }];
  }

  const args = buildArgs(tool, text, resolvedEnums);

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

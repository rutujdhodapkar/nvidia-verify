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
  return candidates.find(t => /post|share|create/i.test(t.name)) || candidates[0];
}

const ARG_PRIORITY = ['text', 'commentary', 'content', 'message', 'body'];

function buildArgs(tool, text) {
  const props = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];
  const args = {};

  // Fill every required prop with sensible values, prioritize main text field
  let textPlaced = false;
  for (const name of Object.keys(props)) {
    const type = props[name].type;
    if (type === 'string') {
      const isMain = ARG_PRIORITY.includes(name);
      if (isMain && !textPlaced) { args[name] = text; textPlaced = true; }
      else if (required.includes(name)) args[name] = '';
    }
  }
  if (!textPlaced) {
    const firstString = Object.keys(props).find(n => props[n].type === 'string') || 'text';
    args[firstString] = text;
  }
  return args;
}

export async function postToLinkedinViaZapier({ token, text }) {
  if (!token) throw new Error('ZAPIER_TOKEN not set');

  const tools = await listTools(token);
  const tool = pickLinkedinTool(tools);
  console.log(`      Using Zapier tool: ${tool.name}`);

  const result = await rpc(token, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: tool.name, arguments: buildArgs(tool, text) },
  });

  if (result?.error) throw new Error(`Zapier tool error: ${JSON.stringify(result.error).slice(0, 300)}`);

  const content = result?.result?.content;
  const summary = Array.isArray(content)
    ? content.map(c => c.text || '').join(' ').slice(0, 200)
    : 'posted';
  console.log(`[POST] ✓ Via Zapier MCP: ${summary}`);
  return { ok: true, detail: summary };
}

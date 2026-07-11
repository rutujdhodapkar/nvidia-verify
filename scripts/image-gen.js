import { chromium } from 'playwright';

export async function generateImage({ html, post, imageMeta, apiKey }) {
  if (html) {
    try {
      const buf = await renderHtml(html);
      console.log(`[IMAGE] ✓ HTML card: ${buf.length} bytes`);
      return buf;
    } catch (err) {
      console.log(`[IMAGE] HTML render failed: ${err.message}`);
    }
  }

  const buf = await tryNvidiaImage(post, imageMeta, apiKey);
  if (buf) return buf;

  const fallbackBuf = await renderHtml(fallbackHtml(imageMeta));
  console.log(`[IMAGE] ✓ Fallback card: ${fallbackBuf.length} bytes`);
  return fallbackBuf;
}

async function renderHtml(html) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });

  const fullHtml = html.includes('<html') ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { width:1200px; height:630px; overflow:hidden; font-family:'Inter',Arial,sans-serif; }
  </style></head><body>${html}</body></html>`;

  await page.setContent(fullHtml, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return buf;
}

async function tryNvidiaImage(post, imageMeta, apiKey) {
  const models = [
    { name: 'qwen-image', url: 'https://ai.api.nvidia.com/v1/vlm/qwen-vl-max', data: { prompt: buildImgPrompt(post, imageMeta), width: 1200, height: 630 } },
    { name: 'FLUX.1-dev', url: 'https://ai.api.nvidia.com/v1/vlm/black-forest-labs/flux.1-dev', data: { prompt: buildImgPrompt(post, imageMeta), width: 1200, height: 630 } },
  ];

  for (const m of models) {
    try {
      const res = await fetch(m.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(m.data),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { console.log(`[IMAGE] ${m.name}: ${res.status}`); continue; }
      const data = await res.json();
      if (data?.image || data?.choices?.[0]?.message?.content) {
        const b64 = (data.image || data.choices[0].message.content).replace(/^data:image\/\w+;base64,/, '');
        return Buffer.from(b64, 'base64');
      }
    } catch (err) { console.log(`[IMAGE] ${m.name}: ${err.message}`); }
  }
  return null;
}

function buildImgPrompt(post, imageMeta) {
  return `Professional LinkedIn banner for DEV/CRAFT free virtual internship platform. Dark background with purple (#6366f1) accents. Clean modern design. Text overlay: "${imageMeta?.headline || '100% Free Virtual Internship'}". No people, no watermarks, no blurry text. 1200x630.`;
}

function fallbackHtml(imageMeta) {
  const headline = imageMeta?.headline || '100% Free Virtual Internship';
  const subtext = imageMeta?.subtext || 'Build real projects. Get certified.';
  const cta = imageMeta?.cta || 'devcraft.fennark.xyz';
  return `
<!DOCTYPE html>
<html><head><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1200px; height:630px; font-family:'Inter',Arial,sans-serif;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  display:flex; align-items:center; justify-content:center; padding:50px; }
.card { width:100%; height:100%; background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.1); border-radius:24px; padding:50px;
  display:flex; flex-direction:column; justify-content:space-between; }
.badge { background:linear-gradient(90deg,#6366f1,#8b5cf6); color:#fff;
  padding:8px 20px; border-radius:100px; font-size:14px; font-weight:600;
  text-transform:uppercase; width:fit-content; }
.content { flex:1; display:flex; flex-direction:column; justify-content:center; gap:15px; }
.headline { font-size:44px; font-weight:800; color:#fff; line-height:1.2; }
.subtext { font-size:22px; color:rgba(255,255,255,0.7); }
.cta { font-size:16px; color:#8b5cf6; font-weight:600; }
.footer { border-top:1px solid rgba(255,255,255,0.08); padding-top:20px;
  display:flex; justify-content:space-between; }
.logo { font-size:22px; font-weight:900; color:#fff; }
.logo span { color:#8b5cf6; }
.url { font-size:13px; color:rgba(255,255,255,0.4); }
</style></head><body>
<div class="card">
  <div class="badge">100% Free</div>
  <div class="content">
    <div class="headline">${headline}</div>
    <div class="subtext">${subtext}</div>
    <div class="cta">${cta}</div>
  </div>
  <div class="footer">
    <div class="logo">DEV<span>/</span>CRAFT</div>
    <div class="url">devcraft.fennark.xyz</div>
  </div>
</div></body></html>`;
}

import { chromium } from 'playwright';

const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt';
const BG_PROMPTS = [
  'Professional modern tech workspace with purple neon lighting, laptop with code on screen, dark aesthetic, cinematic lighting, depth of field',
  'Abstract purple and blue technology background with geometric shapes, glowing grid lines, futuristic data visualization, dark mode',
  'Modern open office space with young diverse professionals collaborating, warm lighting, tech startup vibe, large windows with city view',
  'Close-up of hands typing on mechanical keyboard with RGB backlight, coding screen in background, bokeh effect, night atmosphere',
  'Futuristic digital classroom with holographic displays showing code, purple and blue ambient lighting, sleek modern furniture',
  'Award certificate on wooden desk with laptop, purple branding elements, professional office background, soft natural lighting',
  'Abstract technology network visualization with connected nodes, glowing purple data streams, dark background, matrix-like aesthetic',
  'Modern campus building entrance with glass facade, students walking, sunny day, clean architecture, aspirational atmosphere',
  'Stylized 3D abstract shapes in purple and indigo, floating geometric forms, soft gradients, modern design aesthetic, clean composition',
  'Night city skyline viewed from modern office window, neon purple accents, laptop silhouette on desk, ambient glow',
  'Diverse group of students working on laptops at modern co-working space, warm lighting, plants, collaborative atmosphere',
  'Digital brain or neural network visualization with purple glowing synapses, dark background, technological aesthetic, abstract intelligence',
];

async function generateAiBackground(post, headline) {
  const seed = [...headline].reduce((a, c) => a + c.charCodeAt(0), 0);
  const prompt = BG_PROMPTS[seed % BG_PROMPTS.length];
  const fullPrompt = `${prompt}, high quality, 1200x630 banner, professional, no text or letters in the image`;

  const url = `${POLLINATIONS_URL}/${encodeURIComponent(fullPrompt)}?width=1200&height=630&nofeed=true`;

  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('Image too small');
  return buf;
}

function buildCompositedHtml(fluxBase64, meta) {
  const b64 = fluxBase64.replace(/^data:image\/\w+;base64,/, '');
  const bgDataUri = `data:image/png;base64,${b64}`;

  const styles = [
    'large-text',    // big bold headline, minimal UI
    'full-bleed',    // minimal overlay, let bg shine
    'bottom-heavy',  // text at bottom, large
    'centered',      // centered layout
  ];
  const styleIdx = [...meta.headline].reduce((a, c) => a + c.charCodeAt(0), 0) % styles.length;
  const style = styles[styleIdx];

  if (style === 'large-text') {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Inter',sans-serif}
.bg{position:absolute;inset:0;background:url('${bgDataUri}') center/cover no-repeat}
.overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.15) 50%,rgba(0,0,0,0.1) 100%)}
.content{position:absolute;inset:0;padding:50px;display:flex;flex-direction:column;justify-content:flex-end}
.tag{display:inline-block;background:#6366f1;color:#fff;padding:8px 20px;font-size:13px;font-weight:700;border-radius:4px;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;width:fit-content}
.headline{font-size:58px;font-weight:900;color:#fff;line-height:1.05;max-width:95%;margin-bottom:12px;text-shadow:0 4px 30px rgba(0,0,0,0.4)}
.subtext{font-size:22px;color:rgba(255,255,255,0.85);line-height:1.4;max-width:80%;margin-bottom:20px;font-weight:400;text-shadow:0 2px 10px rgba(0,0,0,0.3)}
.bottom{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:20px}
.brand{font-size:15px;color:rgba(255,255,255,0.5);font-weight:600}
.cta{background:#6366f1;color:#fff;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none}
.badge-row{display:flex;gap:10px;margin-bottom:25px}
.badge{padding:6px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;font-size:12px;color:rgba(255,255,255,0.8);background:rgba(0,0,0,0.3);font-weight:500}
</style></head><body>
<div class="bg"></div>
<div class="overlay"></div>
<div class="content">
  <div class="tag">DEV/CRAFT</div>
  <div class="badge-row">
    <span class="badge">PYTHON · DSA · WEB</span>
    <span class="badge">AI/ML · CLOUD</span>
    <span class="badge">INDUSTRY PROJECTS</span>
  </div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now →</span>
  </div>
</div>
</body></html>`;
  }

  if (style === 'full-bleed') {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Inter',sans-serif}
.bg{position:absolute;inset:0;background:url('${bgDataUri}') center/cover no-repeat}
.overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.05) 60%,rgba(0,0,0,0) 100%)}
.content{position:absolute;inset:0;padding:45px;display:flex;flex-direction:column;justify-content:flex-end}
.tag{display:inline-block;background:rgba(99,102,241,0.95);color:#fff;padding:7px 18px;font-size:12px;font-weight:700;border-radius:4px;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px;width:fit-content}
.headline{font-size:54px;font-weight:900;color:#fff;line-height:1.08;max-width:90%;margin-bottom:10px;text-shadow:0 4px 30px rgba(0,0,0,0.4)}
.subtext{font-size:21px;color:rgba(255,255,255,0.9);line-height:1.45;max-width:75%;margin-bottom:18px;font-weight:400}
.bottom{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.12);padding-top:18px}
.brand{font-size:14px;color:rgba(255,255,255,0.45);font-weight:500}
.cta{background:#6366f1;color:#fff;padding:13px 34px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;box-shadow:0 4px 15px rgba(99,102,241,0.3)}
.badge-row{display:flex;gap:10px;margin-bottom:22px}
.badge{padding:5px 15px;border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-size:11px;color:rgba(255,255,255,0.75);background:rgba(0,0,0,0.25);font-weight:500}
</style></head><body>
<div class="bg"></div>
<div class="overlay"></div>
<div class="content">
  <div class="tag">DEV/CRAFT</div>
  <div class="badge-row">
    <span class="badge">PYTHON · DSA · WEB</span>
    <span class="badge">AI/ML · CLOUD</span>
    <span class="badge">INDUSTRY PROJECTS</span>
  </div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now →</span>
  </div>
</div>
</body></html>`;
  }

  if (style === 'bottom-heavy') {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Inter',sans-serif}
.bg{position:absolute;inset:0;background:url('${bgDataUri}') center/cover no-repeat}
.overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.3) 45%,rgba(0,0,0,0.05) 100%)}
.content{position:absolute;inset:0;padding:45px 50px;display:flex;flex-direction:column;justify-content:flex-end}
.tag{display:inline-block;background:#6366f1;color:#fff;padding:8px 22px;font-size:13px;font-weight:700;border-radius:4px;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:18px;width:fit-content}
.headline{font-size:60px;font-weight:900;color:#fff;line-height:1.05;max-width:95%;margin-bottom:10px;text-shadow:0 4px 30px rgba(0,0,0,0.5)}
.subtext{font-size:23px;color:rgba(255,255,255,0.85);line-height:1.4;max-width:85%;margin-bottom:22px;font-weight:500}
.bottom{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.15);padding-top:20px}
.brand{font-size:15px;color:rgba(255,255,255,0.5);font-weight:500}
.cta{background:#6366f1;color:#fff;padding:14px 38px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;box-shadow:0 4px 15px rgba(99,102,241,0.3)}
</style></head><body>
<div class="bg"></div>
<div class="overlay"></div>
<div class="content">
  <div class="tag">DEV/CRAFT</div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now →</span>
  </div>
</div>
</body></html>`;
  }

  // centered style
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:'Inter',sans-serif}
.bg{position:absolute;inset:0;background:url('${bgDataUri}') center/cover no-repeat}
.overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,0.5) 0%,rgba(0,0,0,0.25) 50%,rgba(0,0,0,0.6) 100%)}
.content{position:absolute;inset:0;padding:50px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.tag{display:inline-block;background:#6366f1;color:#fff;padding:8px 20px;font-size:12px;font-weight:700;border-radius:4px;letter-spacing:2px;text-transform:uppercase;margin-bottom:25px;width:fit-content}
.headline{font-size:56px;font-weight:900;color:#fff;line-height:1.08;max-width:90%;margin-bottom:15px;text-shadow:0 4px 30px rgba(0,0,0,0.4)}
.subtext{font-size:20px;color:rgba(255,255,255,0.85);line-height:1.5;max-width:65%;margin-bottom:30px;font-weight:400}
.bottom{display:flex;flex-direction:column;align-items:center;gap:15px}
.brand{font-size:14px;color:rgba(255,255,255,0.4);font-weight:500}
.cta{background:#6366f1;color:#fff;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(99,102,241,0.3)}
.badge-row{display:flex;gap:10px;margin-bottom:30px}
.badge{padding:6px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:4px;font-size:11px;color:rgba(255,255,255,0.7);background:rgba(0,0,0,0.2);font-weight:500}
</style></head><body>
<div class="bg"></div>
<div class="overlay"></div>
<div class="content">
  <div class="tag">DEV/CRAFT</div>
  <div class="badge-row">
    <span class="badge">PYTHON · DSA · WEB</span>
    <span class="badge">AI/ML · CLOUD</span>
    <span class="badge">INDUSTRY PROJECTS</span>
  </div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now →</span>
  </div>
</div>
</body></html>`;
}

async function compositeTextOverImage(fluxBuffer, meta) {
  const b64 = fluxBuffer.toString('base64');
  const html = buildCompositedHtml(b64, meta);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return buf;
}

async function renderHtml(html) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const fullHtml = html.includes('<html') ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Mono:wght@700&family=Press+Start+2P&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;}</style></head><body>${html}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return buf;
}

function pickTemplate(meta) {
  const templates = { brutalist, 'modern-minimal': modernMinimal, glassmorphism, 'gradient-bold': gradientBold, 'dark-tech': darkTech, 'pixel-art': pixelArt, 'corporate-clean': corporateClean };
  return (templates[meta.style] || brutalist)(meta);
}

export async function generateImage({ html, post, imageMeta, apiKey, hfToken }) {
  const meta = { headline: 'DEV/CRAFT Virtual Internship', subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'devcraft.fennark.xyz', style: 'brutalist', ...(imageMeta || {}) };

  try {
    const bgBuffer = await generateAiBackground(post, meta.headline);
    const composited = await compositeTextOverImage(bgBuffer, meta);
    console.log(`[IMAGE] ✓ AI bg + overlay: ${composited.length} bytes`);
    return composited;
  } catch (err) {
    console.log(`[IMAGE] AI bg failed: ${err.message}, falling back...`);
  }

  if (html && html.length > 200) {
    try {
      const buf = await renderHtml(html);
      if (buf && buf.length > 1000) { console.log(`[IMAGE] ✓ AI card: ${buf.length} bytes`); return buf; }
    } catch (err) { console.log(`[IMAGE] AI HTML failed: ${err.message}`); }
  }

  const nv = await tryNvidiaImage(post, meta, apiKey);
  if (nv) return nv;

  const templateHtml = pickTemplate(meta);
  const buf = await renderHtml(templateHtml);
  console.log(`[IMAGE] ✓ Template card (${meta.style}): ${buf.length} bytes`);
  return buf;
}

async function tryNvidiaImage(post, meta, apiKey) {
  const models = [
    { name: 'qwen-image', url: 'https://ai.api.nvidia.com/v1/vlm/qwen-vl-max', data: { prompt: buildImgPrompt(post, meta), width: 1200, height: 630 } },
  ];
  for (const m of models) {
    try {
      const res = await fetch(m.url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(m.data), signal: AbortSignal.timeout(30000) });
      if (!res.ok) continue;
      const data = await res.json();
      let b64 = data?.image || data?.choices?.[0]?.message?.content || '';
      b64 = b64.replace(/^data:image\/\w+;base64,/, '');
      if (b64.length > 100) return Buffer.from(b64, 'base64');
    } catch {}
  }
  return null;
}

function buildImgPrompt(post, meta) {
  return `LinkedIn banner for DEV/CRAFT virtual internship. Professional tech design. "${meta.headline}". Dark bg with purple accents. 1200x630.`;
}

function brutalist(m) {
  return `<div style="width:1200px;height:630px;background:#1a1a1a;display:flex;flex-direction:column;font-family:'Space Mono',monospace;padding:50px;border:8px solid #6366f1;">
    <div style="border:4px solid #fff;flex:1;display:flex;flex-direction:column;padding:40px;position:relative;">
      <div style="position:absolute;top:-20px;left:30px;background:#6366f1;color:#fff;padding:8px 24px;font-size:16px;font-weight:700;text-transform:uppercase;">SKILLS</div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:56px;font-weight:900;color:#fff;line-height:1.1;text-transform:uppercase;margin-bottom:20px;">${m.headline}</div>
        <div style="width:80px;height:8px;background:#6366f1;margin-bottom:25px;"></div>
        <div style="font-size:22px;color:#bbb;line-height:1.5;">${m.subtext}</div>
      </div>
      <div style="border-top:4px solid #333;padding-top:20px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#666;">DEV/CRAFT</span>
        <span style="background:#6366f1;color:#fff;padding:10px 30px;font-size:15px;font-weight:700;">APPLY →</span>
      </div>
    </div>
  </div>`;
}

function modernMinimal(m) {
  return `<div style="width:1200px;height:630px;background:#0a0a0f;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:60px;">
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <span style="padding:6px 16px;border:1px solid #2a2a3a;border-radius:4px;font-size:12px;color:#888;">PYTHON</span>
        <span style="padding:6px 16px;border:1px solid #2a2a3a;border-radius:4px;font-size:12px;color:#888;">DSA</span>
        <span style="padding:6px 16px;border:1px solid #2a2a3a;border-radius:4px;font-size:12px;color:#888;">WEB DEV</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:14px;color:#6366f1;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;">DEV/CRAFT VIRTUAL INTERNSHIP</div>
        <div style="font-size:50px;font-weight:800;color:#fff;line-height:1.15;max-width:90%;">${m.headline}</div>
        <div style="margin-top:15px;font-size:20px;color:#666;line-height:1.6;max-width:70%;">${m.subtext}</div>
      </div>
      <div style="border-top:1px solid #1a1a2a;padding-top:25px;display:flex;justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:30px;"><span style="font-size:13px;color:#444;">devcraft.fennark.xyz</span></div>
        <div style="background:#6366f1;color:#fff;padding:12px 32px;font-size:14px;font-weight:600;border-radius:6px;">Register Now →</div>
      </div>
    </div>
  </div>`;
}

function glassmorphism(m) {
  return `<div style="width:1200px;height:630px;background:#0d0d1a;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:rgba(99,102,241,0.08);"></div>
    <div style="position:absolute;bottom:-50px;left:-50px;width:250px;height:250px;border-radius:50%;background:rgba(139,92,246,0.06);"></div>
    <div style="background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.06);border-radius:32px;padding:50px;width:92%;height:85%;display:flex;flex-direction:column;position:relative;">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <span style="font-size:20px;font-weight:800;color:#fff;">DEV<span style="color:#6366f1;">/</span>CRAFT</span>
        <span style="padding:8px 20px;border:1px solid rgba(99,102,241,0.3);border-radius:20px;font-size:12px;color:#6366f1;">Real Projects. Real Skills.</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:48px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:15px;">${m.headline}</div>
        <div style="width:60px;height:4px;background:linear-gradient(90deg,#6366f1,transparent);margin-bottom:20px;"></div>
        <div style="font-size:20px;color:rgba(255,255,255,0.6);line-height:1.6;max-width:75%;">${m.subtext}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid rgba(255,255,255,0.05);">
        <span style="font-size:13px;color:rgba(255,255,255,0.3);">For Indian CS engineers</span>
        <span style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#fff;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:500;">devcraft.fennark.xyz →</span>
      </div>
    </div>
  </div>`;
}

function gradientBold(m) {
  return `<div style="width:1200px;height:630px;background:linear-gradient(135deg,#0f0f1a 0%,#1a1a3e 50%,#0f0f1a 100%);display:flex;font-family:'Inter',sans-serif;padding:50px;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg,#6366f1,#a855f7,#6366f1);"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:40px;">
      <div style="display:flex;gap:10px;margin-bottom:25px;">
        <span style="padding:6px 18px;background:rgba(99,102,241,0.15);border-radius:4px;font-size:12px;color:#6366f1;font-weight:600;">AI/ML</span>
        <span style="padding:6px 18px;background:rgba(255,255,255,0.05);border-radius:4px;font-size:12px;color:#888;">CLOUD</span>
      </div>
      <div style="font-size:52px;font-weight:900;color:#fff;line-height:1.1;margin-bottom:15px;">${m.headline}</div>
      <div style="font-size:24px;font-weight:300;color:#888;line-height:1.5;max-width:80%;">${m.subtext}</div>
    </div>
    <div style="width:1px;background:rgba(99,102,241,0.2);margin:20px 0;"></div>
    <div style="width:280px;display:flex;flex-direction:column;justify-content:center;align-items:center;padding-left:40px;gap:20px;">
      <div style="font-size:40px;font-weight:900;color:#6366f1;">SKILLS</div>
      <div style="font-size:13px;color:#666;text-align:center;">Build In-Demand Expertise</div>
      <div style="background:linear-gradient(90deg,#6366f1,#8b5cf6);color:#fff;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;width:100%;text-align:center;">Apply Now →</div>
    </div>
  </div>`;
}

function darkTech(m) {
  return `<div style="width:1200px;height:630px;background:radial-gradient(ellipse at 30% 50%,#1a1a3e 0%,#0a0a12 70%);display:flex;font-family:'Inter',sans-serif;padding:50px;position:relative;overflow:hidden;">
    <svg style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.03;" viewBox="0 0 1200 630">
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" stroke-width="0.5"/></pattern>
      <rect width="1200" height="630" fill="url(#grid)"/>
    </svg>
    <div style="position:absolute;top:50%;right:-80px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.06),transparent);transform:translateY(-50%);"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1;">
      <div style="display:flex;align-items:center;gap:15px;margin-bottom:30px;">
        <span style="width:8px;height:8px;border-radius:50%;background:#6366f1;box-shadow:0 0 12px #6366f1;"></span>
        <span style="font-size:13px;color:#6366f1;font-weight:600;letter-spacing:4px;text-transform:uppercase;">DEV/CRAFT INTERNSHIP</span>
      </div>
      <div style="font-size:54px;font-weight:800;color:#fff;line-height:1.1;">${m.headline}</div>
      <div style="margin-top:20px;font-size:20px;color:#555;line-height:1.6;max-width:65%;">${m.subtext}</div>
      <div style="margin-top:30px;display:flex;gap:15px;align-items:center;">
        <span style="background:#6366f1;color:#fff;padding:14px 35px;border-radius:6px;font-size:15px;font-weight:600;">Get Started</span>
        <span style="color:#555;font-size:13px;">Hands-on engineering projects</span>
      </div>
    </div>
  </div>`;
}

function pixelArt(m) {
  return `<div style="width:1200px;height:630px;background:#2d1b69;display:flex;flex-direction:column;font-family:'Press Start 2P',monospace;padding:40px;position:relative;overflow:hidden;image-rendering:pixelated;">
    <div style="position:absolute;top:0;left:0;right:0;height:8px;background:repeating-linear-gradient(90deg,#6366f1 0px,#6366f1 16px,#7c3aed 16px,#7c3aed 32px);"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:8px;background:repeating-linear-gradient(90deg,#7c3aed 0px,#7c3aed 16px,#6366f1 16px,#6366f1 32px);"></div>
    <div style="border:4px solid #6366f1;flex:1;display:flex;flex-direction:column;padding:30px;background:linear-gradient(180deg,#1a0a3e,#2d1b69);">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <div style="background:#6366f1;color:#fff;padding:8px 16px;font-size:10px;">SKILLS</div>
        <div style="color:#fff;font-size:18px;">DEV/CRAFT</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:15px;">
        <div style="font-size:28px;color:#fff;line-height:1.3;text-transform:uppercase;">${m.headline}</div>
        <div style="width:100%;height:4px;background:repeating-linear-gradient(90deg,#6366f1 0px,#6366f1 20px,transparent 20px,transparent 30px);"></div>
        <div style="font-size:12px;color:#aaa;line-height:1.8;">${m.subtext}</div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="background:#6366f1;color:#fff;padding:12px 20px;font-size:10px;border:2px solid #7c3aed;">→ REGISTER</div>
        <div style="color:#6366f1;padding:12px 20px;font-size:8px;border:2px solid #6366f1;">devcraft.fennark.xyz</div>
      </div>
    </div>
  </div>`;
}

function corporateClean(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;font-family:'Inter',sans-serif;padding:0;">
    <div style="width:60%;padding:60px;display:flex;flex-direction:column;justify-content:center;">
      <div style="margin-bottom:25px;">
        <span style="padding:6px 16px;background:#eef2ff;color:#6366f1;font-size:12px;font-weight:600;border-radius:4px;">DEVCRAFT INTERNSHIP PROGRAM</span>
      </div>
      <div style="font-size:42px;font-weight:800;color:#111;line-height:1.2;margin-bottom:10px;">${m.headline}</div>
      <div style="width:50px;height:4px;background:#6366f1;margin-bottom:20px;"></div>
      <div style="font-size:18px;color:#555;line-height:1.7;margin-bottom:30px;">${m.subtext}</div>
      <div style="display:flex;gap:15px;">
        <span style="background:#111;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Apply at devcraft.fennark.xyz →</span>
      </div>
    </div>
    <div style="width:40%;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px;">
      <div style="font-size:72px;font-weight:900;color:rgba(255,255,255,0.15);">DEV/</div>
      <div style="font-size:72px;font-weight:900;color:rgba(255,255,255,0.15);">CRAFT</div>
      <div style="margin-top:30px;text-align:center;">
        <div style="font-size:36px;font-weight:700;color:#fff;">REAL</div>
        <div style="font-size:16px;color:rgba(255,255,255,0.7);">Industry Projects</div>
      </div>
    </div>
  </div>`;
}

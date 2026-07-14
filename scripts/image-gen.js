import { chromium } from 'playwright';

const HF_API = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev';

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

async function generateHfBackground(post, headline, hfToken) {
  const seed = [...headline].reduce((a, c) => a + c.charCodeAt(0), 0);
  const prompt = BG_PROMPTS[seed % BG_PROMPTS.length];
  const fullPrompt = `${prompt}, high quality, 1200x630 banner, professional, no text or letters in the image`;

  const res = await fetch(HF_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: fullPrompt }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`HF ${res.status}: ${err.slice(0, 100)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500) throw new Error('Image too small');
  return buf;
}

function buildCompositedHtml(fluxBase64, meta) {
  const b64 = fluxBase64.replace(/^data:image\/\w+;base64,/, '');
  const bgDataUri = `data:image/png;base64,${b64}`;

  const styles = [
    'large-text',
    'full-bleed',
    'bottom-heavy',
    'centered',
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
    <span class="badge">PYTHON &bull; DSA &bull; WEB</span>
    <span class="badge">AI/ML &bull; CLOUD</span>
    <span class="badge">INDUSTRY PROJECTS</span>
  </div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now &rarr;</span>
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
    <span class="badge">PYTHON &bull; DSA &bull; WEB</span>
    <span class="badge">AI/ML &bull; CLOUD</span>
    <span class="badge">INDUSTRY PROJECTS</span>
  </div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now &rarr;</span>
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
    <span class="cta">Register Now &rarr;</span>
  </div>
</div>
</body></html>`;
  }

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
    <span class="badge">PYTHON &bull; DSA &bull; WEB</span>
    <span class="badge">AI/ML &bull; CLOUD</span>
    <span class="badge">INDUSTRY PROJECTS</span>
  </div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="bottom">
    <span class="brand">devcraft.fennark.xyz</span>
    <span class="cta">Register Now &rarr;</span>
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
  const fullHtml = html.includes('<html') ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Mono:wght@700&family=Press+Start+2P&family=DM+Sans:wght@500;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;}</style></head><body>${html}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return buf;
}

function pickTemplate(meta) {
  const templates = {
    brutalist,
    'modern-minimal': modernMinimal,
    glassmorphism,
    'split-panel': splitPanel,
    terminal,
    magazine,
    'dark-tech': darkTech,
    'pixel-art': pixelArt,
    'corporate-clean': corporateClean,
    bento,
    outline,
    'lateral-band': lateralBand,
  };
  return (templates[meta.style] || brutalist)(meta);
}

export async function generateImage({ html, post, imageMeta, designBrief, apiKey, hfToken }) {
  const meta = { headline: 'DEV/CRAFT Virtual Internship', subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'devcraft.fennark.xyz', style: 'brutalist', ...(imageMeta || {}) };

  // Pick template style from design brief
  if (designBrief?.tone) {
    const toneMap = {
      'clean': 'modern-minimal',
      'editorial': 'magazine',
      'bold': 'dark-tech',
      'playful': 'bento',
      'professional': 'corporate-clean',
      'tech': 'terminal',
      'creative': 'split-panel',
    };
    meta.style = toneMap[designBrief.tone] || meta.style;
    console.log(`[IMAGE] Style "${meta.style}" from design brief tone "${designBrief.tone}"`);
  }

  // Primary: render a code-based modern template (fast, reliable, no API dependency)
  const templateHtml = pickTemplate(meta);
  const buf = await renderHtml(templateHtml);
  console.log(`[IMAGE] Template card (${meta.style}): ${buf.length} bytes`);
  if (buf && buf.length > 500) return buf;

  throw new Error('Template rendering produced no output');
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
  return `LinkedIn banner for DEV/CRAFT virtual internship. Clean white background with bold black text. Purple accent elements. Rounded card design. 1200x630.`;
}

function brutalist(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:0;">
    <div style="background:#000;padding:14px 40px;">
      <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:3px;text-transform:uppercase;">DEV/CRAFT</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:50px;margin:0 20px;border-left:6px solid #000;">
      <div style="margin-bottom:15px;">
        <span style="background:#000;color:#fff;padding:6px 18px;font-size:12px;font-weight:700;text-transform:uppercase;border-radius:20px;">Skills</span>
      </div>
      <div style="font-size:52px;font-weight:900;color:#000;line-height:1.1;margin-bottom:10px;">${m.headline}</div>
      <div style="font-size:20px;color:#555;font-weight:400;line-height:1.5;max-width:80%;">${m.subtext}</div>
    </div>
    <div style="border-top:2px solid #eee;padding:18px 40px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:13px;color:#999;font-weight:400;">Virtual Internship Program</span>
      <span style="background:#000;color:#fff;padding:10px 28px;font-size:14px;font-weight:600;border-radius:12px;">Apply &rarr;</span>
    </div>
  </div>`;
}

function modernMinimal(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:60px;">
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="display:flex;gap:10px;margin-bottom:20px;">
        <span style="padding:6px 18px;border:1px solid #ccc;border-radius:20px;font-size:12px;color:#666;">Python</span>
        <span style="padding:6px 18px;border:1px solid #ccc;border-radius:20px;font-size:12px;color:#666;">DSA</span>
        <span style="padding:6px 18px;border:1px solid #ccc;border-radius:20px;font-size:12px;color:#666;">Web Dev</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:12px;color:#000;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;">DEV/CRAFT VIRTUAL INTERNSHIP</div>
        <div style="font-size:54px;font-weight:900;color:#000;line-height:1.1;max-width:90%;">${m.headline}</div>
        <div style="margin-top:15px;font-size:20px;color:#555;font-weight:400;line-height:1.6;max-width:70%;">${m.subtext}</div>
      </div>
      <div style="border-top:1px solid #eee;padding-top:22px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#999;">devcraft.fennark.xyz</span>
        <div style="background:#000;color:#fff;padding:12px 32px;font-size:14px;font-weight:600;border-radius:14px;">Register Now &rarr;</div>
      </div>
    </div>
  </div>`;
}

function glassmorphism(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-100px;right:-100px;width:300px;height:300px;border-radius:50%;background:rgba(0,0,0,0.03);"></div>
    <div style="position:absolute;bottom:-60px;left:-60px;width:200px;height:200px;border-radius:50%;background:rgba(0,0,0,0.02);"></div>
    <div style="background:rgba(255,255,255,0.7);border:1px solid #eee;border-radius:24px;padding:50px;width:92%;height:85%;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.04);">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <span style="font-size:20px;font-weight:800;color:#000;">DEV/CRAFT</span>
        <span style="padding:8px 22px;border:1px solid #e0e0e0;border-radius:20px;font-size:12px;color:#666;">Real Projects. Real Skills.</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:50px;font-weight:800;color:#000;line-height:1.15;margin-bottom:12px;">${m.headline}</div>
        <div style="width:50px;height:4px;background:#000;border-radius:2px;margin-bottom:18px;"></div>
        <div style="font-size:20px;color:#555;font-weight:400;line-height:1.6;max-width:75%;">${m.subtext}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:18px;border-top:1px solid #eee;">
        <span style="font-size:13px;color:#999;">For Indian engineering students</span>
        <span style="background:#000;color:#fff;padding:12px 32px;border-radius:14px;font-size:14px;font-weight:600;">devcraft.fennark.xyz &rarr;</span>
      </div>
    </div>
  </div>`;
}

function splitPanel(m) {
  return `<div style="width:1200px;height:630px;display:flex;font-family:'Inter',sans-serif;">
    <div style="width:60%;background:#fff;padding:60px 50px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:11px;color:#000;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:15px;">DEV/CRAFT VIRTUAL INTERNSHIP</div>
      <div style="font-size:50px;font-weight:900;color:#000;line-height:1.1;margin-bottom:12px;">${m.headline}</div>
      <div style="width:50px;height:4px;background:#000;border-radius:2px;margin-bottom:18px;"></div>
      <div style="font-size:18px;color:#555;font-weight:400;line-height:1.6;max-width:90%;">${m.subtext}</div>
      <div style="margin-top:28px;display:flex;gap:10px;">
        <span style="padding:6px 16px;border:1px solid #ccc;border-radius:20px;font-size:12px;color:#666;">Python</span>
        <span style="padding:6px 16px;border:1px solid #ccc;border-radius:20px;font-size:12px;color:#666;">DSA</span>
        <span style="padding:6px 16px;border:1px solid #ccc;border-radius:20px;font-size:12px;color:#666;">AI/ML</span>
      </div>
    </div>
    <div style="width:40%;background:#000;padding:60px 40px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
      <div style="font-size:60px;font-weight:900;color:rgba(255,255,255,0.1);line-height:1;">DEV/</div>
      <div style="font-size:60px;font-weight:900;color:rgba(255,255,255,0.1);line-height:1;">CRAFT</div>
      <div style="margin-top:25px;color:#fff;font-size:15px;font-weight:500;padding:14px 30px;border:1px solid rgba(255,255,255,0.3);border-radius:14px;">devcraft.fennark.xyz</div>
    </div>
  </div>`;
}

function terminal(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Space Mono',monospace;padding:0;position:relative;">
    <div style="background:#f0f0f0;padding:12px 20px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e0e0e0;">
      <span style="width:12px;height:12px;border-radius:50%;background:#ff5555;"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#f1fa8c;"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#50fa7b;"></span>
      <span style="color:#999;font-size:11px;margin-left:12px;font-family:'Inter',sans-serif;">devcraft — bash</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:40px 50px;">
      <div style="font-size:13px;color:#000;margin-bottom:8px;font-family:'Inter',sans-serif;font-weight:600;">$ ./internship --launch</div>
      <div style="font-size:44px;font-weight:700;color:#000;line-height:1.15;margin-bottom:6px;font-family:'Inter',sans-serif;">${m.headline}</div>
      <div style="font-size:14px;color:#000;margin-bottom:12px;font-family:'Inter',sans-serif;">&gt;&gt; Status: <span style="font-weight:600;">OPEN</span></div>
      <div style="font-size:17px;color:#555;line-height:1.5;font-family:'Inter',sans-serif;max-width:80%;font-weight:400;">${m.subtext}</div>
      <div style="margin-top:22px;display:flex;gap:12px;align-items:center;">
        <span style="font-size:12px;color:#999;font-family:'Inter',sans-serif;">$ cat apply.txt | grep "link"</span>
        <span style="font-size:12px;color:#000;font-family:'Inter',sans-serif;font-weight:600;">devcraft.fennark.xyz</span>
      </div>
    </div>
  </div>`;
}

function magazine(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:0;position:relative;">
    <div style="height:6px;background:#000;width:100%;"></div>
    <div style="flex:1;display:flex;padding:45px 55px;">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:50px;">
        <div style="font-size:11px;color:#000;font-weight:600;letter-spacing:4px;text-transform:uppercase;margin-bottom:18px;">Cover Story — Skills</div>
        <div style="font-size:46px;font-weight:900;color:#000;line-height:1.1;margin-bottom:10px;">${m.headline}</div>
        <div style="width:50px;height:3px;background:#000;margin-bottom:16px;"></div>
        <div style="font-size:17px;color:#555;font-weight:400;line-height:1.6;max-width:85%;">${m.subtext}</div>
      </div>
      <div style="width:260px;display:flex;align-items:flex-end;">
        <div style="background:#f5f5f5;border-radius:16px;padding:28px 22px;width:100%;">
          <div style="font-size:40px;font-weight:900;color:#000;line-height:1;margin-bottom:5px;">'26</div>
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">Industry Projects</div>
          <div style="margin-top:18px;padding:10px 0;border-bottom:1px solid #e0e0e0;font-size:13px;color:#888;">devcraft.fennark.xyz</div>
        </div>
      </div>
    </div>
    <div style="height:1px;background:#eee;margin:0 55px;"></div>
    <div style="padding:14px 55px;display:flex;justify-content:space-between;font-size:11px;color:#bbb;text-transform:uppercase;">
      <span>DEV/CRAFT — Edition #1</span>
      <span>Virtual Internship 2026</span>
    </div>
  </div>`;
}

function darkTech(m) {
  return `<div style="width:1200px;height:630px;background:#0a0a12;display:flex;font-family:'Inter',sans-serif;padding:50px;position:relative;overflow:hidden;">
    <svg style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.03;" viewBox="0 0 1200 630">
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" stroke-width="0.5"/></pattern>
      <rect width="1200" height="630" fill="url(#grid)"/>
    </svg>
    <div style="position:absolute;top:50%;right:-80px;width:400px;height:400px;border-radius:50%;background:rgba(99,102,241,0.04);"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:1;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:25px;">
        <span style="width:8px;height:8px;border-radius:50%;background:#000;"></span>
        <span style="font-size:12px;color:#000;font-weight:600;letter-spacing:3px;text-transform:uppercase;">DEV/CRAFT INTERNSHIP</span>
      </div>
      <div style="font-size:54px;font-weight:800;color:#fff;line-height:1.1;">${m.headline}</div>
      <div style="margin-top:18px;font-size:19px;color:#aaa;line-height:1.6;max-width:65%;font-weight:400;">${m.subtext}</div>
      <div style="margin-top:30px;display:flex;gap:15px;align-items:center;">
        <span style="background:#fff;color:#000;padding:14px 35px;border-radius:14px;font-size:15px;font-weight:600;">Get Started</span>
        <span style="color:#888;font-size:13px;font-weight:400;">Build real engineering skills</span>
      </div>
    </div>
  </div>`;
}

function pixelArt(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:0;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:6px;background:#000;"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;z-index:1;padding:0 40px;">
      <div style="background:#000;color:#fff;padding:8px 22px;font-size:12px;font-weight:600;text-transform:uppercase;border-radius:20px;margin-bottom:25px;">Skills</div>
      <div style="font-size:48px;font-weight:900;color:#000;line-height:1.15;margin-bottom:10px;">${m.headline}</div>
      <div style="width:60px;height:4px;background:#000;border-radius:2px;margin-bottom:16px;"></div>
      <div style="font-size:18px;color:#555;line-height:1.6;max-width:70%;font-weight:400;">${m.subtext}</div>
      <div style="margin-top:25px;">
        <span style="color:#000;padding:12px 24px;font-size:13px;font-weight:500;border:1px solid #000;border-radius:12px;">devcraft.fennark.xyz</span>
      </div>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:6px;background:#000;"></div>
  </div>`;
}

function corporateClean(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;font-family:'Inter',sans-serif;padding:0;border-radius:0;">
    <div style="width:65%;padding:60px;display:flex;flex-direction:column;justify-content:center;">
      <div style="margin-bottom:22px;">
        <span style="padding:6px 18px;background:#f0f0f0;color:#000;font-size:12px;font-weight:600;border-radius:20px;">DEVCRAFT INTERNSHIP PROGRAM</span>
      </div>
      <div style="font-size:44px;font-weight:900;color:#000;line-height:1.15;margin-bottom:8px;">${m.headline}</div>
      <div style="width:45px;height:3px;background:#000;border-radius:2px;margin-bottom:18px;"></div>
      <div style="font-size:18px;color:#555;font-weight:400;line-height:1.7;margin-bottom:28px;max-width:90%;">${m.subtext}</div>
      <div style="display:flex;gap:15px;">
        <span style="background:#000;color:#fff;padding:12px 28px;border-radius:12px;font-size:14px;font-weight:600;">Apply at devcraft.fennark.xyz &rarr;</span>
      </div>
    </div>
    <div style="width:35%;background:#000;border-radius:0;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px;">
      <div style="font-size:64px;font-weight:900;color:rgba(255,255,255,0.12);line-height:1;">DEV/</div>
      <div style="font-size:64px;font-weight:900;color:rgba(255,255,255,0.12);line-height:1;">CRAFT</div>
      <div style="margin-top:25px;text-align:center;">
        <div style="font-size:32px;font-weight:700;color:#fff;">REAL</div>
        <div style="font-size:15px;color:rgba(255,255,255,0.7);font-weight:400;">Industry Projects</div>
      </div>
    </div>
  </div>`;
}

function bento(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;padding:8px;font-family:'Inter',sans-serif;">
    <div style="grid-column:1/2;grid-row:1/3;background:#f5f5f5;border-radius:20px;padding:40px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:11px;color:#000;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">DEV/CRAFT</div>
      <div style="font-size:38px;font-weight:900;color:#000;line-height:1.1;margin-bottom:6px;">${m.headline}</div>
      <div style="font-size:14px;color:#555;line-height:1.5;font-weight:400;">${m.subtext}</div>
    </div>
    <div style="background:#f5f5f5;border-radius:20px;padding:28px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:30px;font-weight:900;color:#000;">PY</div>
      <div style="font-size:13px;color:#888;margin-top:5px;font-weight:400;">Python</div>
    </div>
    <div style="background:#f5f5f5;border-radius:20px;padding:28px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:30px;font-weight:900;color:#000;">DSA</div>
      <div style="font-size:13px;color:#888;margin-top:5px;font-weight:400;">Data Structures</div>
    </div>
    <div style="background:#f5f5f5;border-radius:20px;padding:28px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:30px;font-weight:900;color:#000;">AI</div>
      <div style="font-size:13px;color:#888;margin-top:5px;font-weight:400;">Machine Learning</div>
    </div>
    <div style="background:#f5f5f5;border-radius:20px;padding:28px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
      <div style="font-size:12px;color:#999;font-weight:400;">devcraft.fennark.xyz</div>
      <div style="margin-top:8px;background:#000;color:#fff;padding:8px 20px;border-radius:12px;font-size:13px;font-weight:600;">Apply &rarr;</div>
    </div>
  </div>`;
}

function outline(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:50px;position:relative;">
    <div style="position:absolute;top:25px;left:25px;right:25px;bottom:25px;border:2px solid #e0e0e0;border-radius:24px;pointer-events:none;"></div>
    <div style="position:absolute;top:25px;left:50%;transform:translateX(-50%);background:#fff;padding:0 20px;font-size:11px;color:#000;font-weight:600;letter-spacing:3px;text-transform:uppercase;">DEV/CRAFT</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;">
      <div style="font-size:56px;font-weight:900;color:#000;line-height:1.05;max-width:85%;margin-bottom:12px;">${m.headline}</div>
      <div style="font-size:19px;color:#555;line-height:1.5;max-width:60%;font-weight:400;">${m.subtext}</div>
      <div style="margin-top:28px;display:flex;gap:16px;align-items:center;">
        <span style="border:2px solid #000;color:#000;padding:12px 32px;border-radius:14px;font-size:14px;font-weight:600;background:transparent;">devcraft.fennark.xyz</span>
        <span style="background:#000;color:#fff;padding:12px 32px;border-radius:14px;font-size:14px;font-weight:600;">Register</span>
      </div>
    </div>
    <div style="position:absolute;bottom:35px;left:50%;transform:translateX(-50%);font-size:10px;color:#ccc;letter-spacing:2px;text-transform:uppercase;font-weight:400;">Build skills that matter</div>
  </div>`;
}

function lateralBand(m) {
  return `<div style="width:1200px;height:630px;background:#fff;display:flex;flex-direction:column;font-family:'Inter',sans-serif;position:relative;">
    <div style="background:#000;padding:18px 50px;">
      <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;">DEV/CRAFT — Virtual Internship 2026</span>
    </div>
    <div style="flex:1;display:flex;padding:50px;">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:40px;">
        <div style="font-size:10px;color:#000;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">Industry Projects — Mentorship</div>
        <div style="font-size:52px;font-weight:900;color:#000;line-height:1.05;margin-bottom:10px;">${m.headline}</div>
        <div style="font-size:18px;color:#555;line-height:1.6;max-width:85%;font-weight:400;">${m.subtext}</div>
        <div style="margin-top:22px;background:#000;color:#fff;padding:14px 30px;border-radius:14px;font-size:14px;font-weight:600;width:fit-content;">devcraft.fennark.xyz &rarr;</div>
      </div>
      <div style="width:3px;background:#000;margin:15px 0;border-radius:2px;"></div>
      <div style="width:220px;display:flex;flex-direction:column;justify-content:center;padding-left:40px;gap:16px;">
        <div style="padding:14px;border-left:3px solid #000;border-radius:0 8px 8px 0;background:#f5f5f5;">
          <div style="font-size:14px;color:#000;font-weight:600;">Python</div>
          <div style="font-size:11px;color:#888;font-weight:400;">Core &amp; Advanced</div>
        </div>
        <div style="padding:14px;border-left:3px solid #000;border-radius:0 8px 8px 0;background:#f5f5f5;">
          <div style="font-size:14px;color:#000;font-weight:600;">DSA</div>
          <div style="font-size:11px;color:#888;font-weight:400;">Problem Solving</div>
        </div>
        <div style="padding:14px;border-left:3px solid #000;border-radius:0 8px 8px 0;background:#f5f5f5;">
          <div style="font-size:14px;color:#000;font-weight:600;">AI/ML</div>
          <div style="font-size:11px;color:#888;font-weight:400;">Hands-on Projects</div>
        </div>
      </div>
    </div>
  </div>`;
}

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
        <span style="background:#6366f1;color:#fff;padding:10px 30px;font-size:15px;font-weight:700;">APPLY &rarr;</span>
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
        <div style="background:#6366f1;color:#fff;padding:12px 32px;font-size:14px;font-weight:600;border-radius:6px;">Register Now &rarr;</div>
      </div>
    </div>
  </div>`;
}

function glassmorphism(m) {
  return `<div style="width:1200px;height:630px;background:#0d0d1a;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-120px;right:-120px;width:350px;height:350px;border-radius:50%;background:rgba(99,102,241,0.06);"></div>
    <div style="position:absolute;bottom:-80px;left:-80px;width:220px;height:220px;border-radius:50%;background:rgba(139,92,246,0.05);"></div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:32px;padding:50px;width:92%;height:85%;display:flex;flex-direction:column;position:relative;">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <span style="font-size:20px;font-weight:800;color:#fff;">DEV<span style="color:#6366f1;">/</span>CRAFT</span>
        <span style="padding:8px 20px;border:1px solid rgba(99,102,241,0.3);border-radius:20px;font-size:12px;color:#6366f1;">Real Projects. Real Skills.</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
        <div style="font-size:48px;font-weight:700;color:#fff;line-height:1.2;margin-bottom:15px;">${m.headline}</div>
        <div style="width:60px;height:4px;background:#6366f1;margin-bottom:20px;"></div>
        <div style="font-size:20px;color:rgba(255,255,255,0.6);line-height:1.6;max-width:75%;">${m.subtext}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:13px;color:rgba(255,255,255,0.3);">For Indian CS engineers</span>
        <span style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#fff;padding:12px 32px;border-radius:12px;font-size:14px;font-weight:500;">devcraft.fennark.xyz &rarr;</span>
      </div>
    </div>
  </div>`;
}

function splitPanel(m) {
  return `<div style="width:1200px;height:630px;display:flex;font-family:'Inter',sans-serif;">
    <div style="width:55%;background:#0a0a0f;padding:60px 50px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:12px;color:#6366f1;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:15px;">DEV/CRAFT VIRTUAL INTERNSHIP</div>
      <div style="font-size:52px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:15px;">${m.headline}</div>
      <div style="width:50px;height:5px;background:#6366f1;margin-bottom:20px;"></div>
      <div style="font-size:19px;color:#555;line-height:1.6;max-width:90%;">${m.subtext}</div>
      <div style="margin-top:30px;display:flex;gap:12px;">
        <span style="padding:6px 14px;border:1px solid #2a2a3a;border-radius:4px;font-size:11px;color:#888;">PYTHON</span>
        <span style="padding:6px 14px;border:1px solid #2a2a3a;border-radius:4px;font-size:11px;color:#888;">DSA</span>
        <span style="padding:6px 14px;border:1px solid #2a2a3a;border-radius:4px;font-size:11px;color:#888;">AI/ML</span>
      </div>
    </div>
    <div style="width:45%;background:#6366f1;padding:60px 50px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
      <div style="font-size:72px;font-weight:900;color:rgba(255,255,255,0.12);">DEV/</div>
      <div style="font-size:72px;font-weight:900;color:rgba(255,255,255,0.12);">CRAFT</div>
      <div style="margin-top:25px;color:#fff;font-size:16px;font-weight:600;padding:14px 32px;border:1px solid rgba(255,255,255,0.3);border-radius:8px;">devcraft.fennark.xyz</div>
    </div>
  </div>`;
}

function terminal(m) {
  return `<div style="width:1200px;height:630px;background:#0d1117;display:flex;flex-direction:column;font-family:'Space Mono',monospace;padding:45px;position:relative;">
    <div style="position:absolute;top:0;left:0;right:0;height:36px;background:#1a1f2b;display:flex;align-items:center;padding:0 16px;gap:8px;">
      <span style="width:12px;height:12px;border-radius:50%;background:#ff5555;"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#f1fa8c;"></span>
      <span style="width:12px;height:12px;border-radius:50%;background:#50fa7b;"></span>
      <span style="color:#555;font-size:11px;margin-left:12px;">devcraft@terminal:~$</span>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-top:20px;">
      <div style="font-size:14px;color:#50fa7b;margin-bottom:10px;font-weight:700;">$ ./internship --launch</div>
      <div style="font-size:44px;font-weight:700;color:#fff;line-height:1.15;margin-bottom:8px;">${m.headline}</div>
      <div style="font-size:15px;color:#50fa7b;margin-bottom:15px;">&gt;&gt; Status: <span style="color:#f1fa8c;">ACTIVE</span> | Slots: <span style="color:#f1fa8c;">LIMITED</span></div>
      <div style="font-size:18px;color:#888;line-height:1.5;font-family:'Inter',sans-serif;max-width:80%;">${m.subtext}</div>
      <div style="margin-top:25px;">
        <pre style="font-size:13px;color:#444;margin:0;">$ <span style="color:#50fa7b;">cat</span> apply.txt | <span style="color:#50fa7b;">grep</span> "link"</pre>
        <div style="font-size:13px;color:#6366f1;margin-top:5px;">devcraft.fennark.xyz</div>
      </div>
    </div>
  </div>`;
}

function magazine(m) {
  return `<div style="width:1200px;height:630px;background:#f8f7f4;display:flex;flex-direction:column;font-family:'DM Sans',sans-serif;padding:0;position:relative;">
    <div style="height:8px;background:#6366f1;width:100%;"></div>
    <div style="flex:1;display:flex;padding:50px 60px;">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:60px;">
        <div style="font-size:11px;color:#6366f1;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:20px;">Cover Story &mdash; Skills</div>
        <div style="font-size:48px;font-weight:800;color:#111;line-height:1.08;margin-bottom:12px;">${m.headline}</div>
        <div style="width:60px;height:3px;background:#6366f1;margin-bottom:18px;"></div>
        <div style="font-size:17px;color:#555;line-height:1.6;max-width:85%;">${m.subtext}</div>
      </div>
      <div style="width:280px;height:100%;display:flex;align-items:flex-end;">
        <div style="background:#111;padding:30px 25px;width:100%;">
          <div style="font-size:48px;font-weight:900;color:#6366f1;line-height:1;margin-bottom:5px;">'26</div>
          <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">Industry Projects</div>
          <div style="margin-top:20px;padding:12px 0;border-bottom:1px solid #2a2a2a;font-size:13px;color:#888;">devcraft.fennark.xyz</div>
        </div>
      </div>
    </div>
    <div style="height:1px;background:#ddd;margin:0 60px;"></div>
    <div style="padding:15px 60px;display:flex;justify-content:space-between;font-size:11px;color:#999;text-transform:uppercase;">
      <span>DEV/CRAFT &mdash; Edition #1</span>
      <span>Virtual Internship 2026</span>
    </div>
  </div>`;
}

function darkTech(m) {
  return `<div style="width:1200px;height:630px;background:#0a0a12;display:flex;font-family:'Inter',sans-serif;padding:50px;position:relative;overflow:hidden;">
    <svg style="position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.04;" viewBox="0 0 1200 630">
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6366f1" stroke-width="0.5"/></pattern>
      <rect width="1200" height="630" fill="url(#grid)"/>
    </svg>
    <div style="position:absolute;top:50%;right:-80px;width:400px;height:400px;border-radius:50%;background:rgba(99,102,241,0.04);"></div>
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
    <div style="position:absolute;top:0;left:0;right:0;height:8px;background:#6366f1;"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:8px;background:#7c3aed;"></div>
    <div style="border:4px solid #6366f1;flex:1;display:flex;flex-direction:column;padding:30px;background:#1a0a3e;">
      <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <div style="background:#6366f1;color:#fff;padding:8px 16px;font-size:10px;">SKILLS</div>
        <div style="color:#fff;font-size:18px;">DEV/CRAFT</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:15px;">
        <div style="font-size:28px;color:#fff;line-height:1.3;text-transform:uppercase;">${m.headline}</div>
        <div style="width:100%;height:4px;background:#6366f1;"></div>
        <div style="font-size:12px;color:#aaa;line-height:1.8;">${m.subtext}</div>
      </div>
      <div style="display:flex;gap:10px;">
        <div style="background:#6366f1;color:#fff;padding:12px 20px;font-size:10px;border:2px solid #7c3aed;">&rarr; REGISTER</div>
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
        <span style="background:#111;color:#fff;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;">Apply at devcraft.fennark.xyz &rarr;</span>
      </div>
    </div>
    <div style="width:40%;background:#6366f1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px;">
      <div style="font-size:72px;font-weight:900;color:rgba(255,255,255,0.15);">DEV/</div>
      <div style="font-size:72px;font-weight:900;color:rgba(255,255,255,0.15);">CRAFT</div>
      <div style="margin-top:30px;text-align:center;">
        <div style="font-size:36px;font-weight:700;color:#fff;">REAL</div>
        <div style="font-size:16px;color:rgba(255,255,255,0.7);">Industry Projects</div>
      </div>
    </div>
  </div>`;
}

function bento(m) {
  return `<div style="width:1200px;height:630px;background:#0a0a0f;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;padding:6px;font-family:'Inter',sans-serif;">
    <div style="grid-column:1/2;grid-row:1/3;background:#111122;border-radius:16px;padding:40px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:11px;color:#6366f1;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">DEV/CRAFT</div>
      <div style="font-size:36px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:8px;">${m.headline}</div>
      <div style="font-size:14px;color:#555;line-height:1.5;">${m.subtext}</div>
    </div>
    <div style="background:#1a1a2e;border-radius:16px;padding:30px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:32px;font-weight:800;color:#6366f1;">PY</div>
      <div style="font-size:12px;color:#666;margin-top:5px;">Python</div>
    </div>
    <div style="background:#1a1a2e;border-radius:16px;padding:30px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:32px;font-weight:800;color:#6366f1;">DSA</div>
      <div style="font-size:12px;color:#666;margin-top:5px;">Data Structures</div>
    </div>
    <div style="background:#1a1a2e;border-radius:16px;padding:30px;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:32px;font-weight:800;color:#6366f1;">AI</div>
      <div style="font-size:12px;color:#666;margin-top:5px;">Machine Learning</div>
    </div>
    <div style="background:#1a1a2e;border-radius:16px;padding:30px;display:flex;flex-direction:column;justify-content:center;align-items:flex-end;">
      <div style="font-size:12px;color:#888;">devcraft.fennark.xyz</div>
      <div style="margin-top:8px;background:#6366f1;color:#fff;padding:8px 18px;border-radius:6px;font-size:12px;font-weight:600;">Apply &rarr;</div>
    </div>
  </div>`;
}

function outline(m) {
  return `<div style="width:1200px;height:630px;background:#0a0a0f;display:flex;flex-direction:column;font-family:'Inter',sans-serif;padding:50px;position:relative;">
    <div style="position:absolute;top:20px;left:20px;right:20px;bottom:20px;border:1px solid #1a1a2a;border-radius:20px;pointer-events:none;"></div>
    <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);background:#0a0a0f;padding:0 20px;font-size:11px;color:#6366f1;font-weight:600;letter-spacing:3px;text-transform:uppercase;">DEV/CRAFT</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;">
      <div style="font-size:60px;font-weight:900;color:#fff;line-height:1.05;max-width:85%;margin-bottom:15px;text-shadow:-1px -1px 0 #6366f1,1px -1px 0 #6366f1,-1px 1px 0 #6366f1,1px 1px 0 #6366f1;">${m.headline}</div>
      <div style="font-size:20px;color:#555;line-height:1.5;max-width:60%;">${m.subtext}</div>
      <div style="margin-top:30px;display:flex;gap:20px;align-items:center;">
        <span style="border:2px solid #6366f1;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;background:transparent;">devcraft.fennark.xyz</span>
        <span style="background:#6366f1;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">Register</span>
      </div>
    </div>
    <div style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);font-size:10px;color:#2a2a3a;letter-spacing:2px;text-transform:uppercase;">Build skills that matter</div>
  </div>`;
}

function lateralBand(m) {
  return `<div style="width:1200px;height:630px;background:#0a0a0f;display:flex;flex-direction:column;font-family:'Inter',sans-serif;position:relative;">
    <div style="background:#6366f1;padding:20px 50px;">
      <span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;">DEV/CRAFT &mdash; Virtual Internship 2026</span>
    </div>
    <div style="flex:1;display:flex;padding:50px;">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-right:50px;">
        <div style="font-size:10px;color:#6366f1;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">Industry Projects &bull; Mentorship</div>
        <div style="font-size:52px;font-weight:900;color:#fff;line-height:1.05;margin-bottom:12px;">${m.headline}</div>
        <div style="font-size:18px;color:#555;line-height:1.6;max-width:85%;">${m.subtext}</div>
        <div style="margin-top:25px;background:#6366f1;color:#fff;padding:14px 30px;border-radius:8px;font-size:14px;font-weight:600;width:fit-content;">devcraft.fennark.xyz &rarr;</div>
      </div>
      <div style="width:4px;background:#6366f1;margin:20px 0;border-radius:2px;"></div>
      <div style="width:250px;display:flex;flex-direction:column;justify-content:center;padding-left:50px;gap:20px;">
        <div style="padding:15px;border-left:3px solid #6366f1;">
          <div style="font-size:14px;color:#fff;font-weight:600;">Python</div>
          <div style="font-size:11px;color:#555;">Core &amp; Advanced</div>
        </div>
        <div style="padding:15px;border-left:3px solid #6366f1;">
          <div style="font-size:14px;color:#fff;font-weight:600;">DSA</div>
          <div style="font-size:11px;color:#555;">Problem Solving</div>
        </div>
        <div style="padding:15px;border-left:3px solid #6366f1;">
          <div style="font-size:14px;color:#fff;font-weight:600;">AI/ML</div>
          <div style="font-size:11px;color:#555;">Hands-on Projects</div>
        </div>
      </div>
    </div>
  </div>`;
}

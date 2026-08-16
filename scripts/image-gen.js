import { chromium } from 'playwright';

const HF_API = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev';

const BG_PROMPTS = [
  'Professional modern tech workspace with teal and cyan neon lighting, laptop with code on screen, dark aesthetic, cinematic lighting, depth of field',
  'Abstract teal and navy technology background with geometric shapes, glowing grid lines, futuristic data visualization, dark mode',
  'Modern open office space with young diverse professionals collaborating, warm lighting, tech startup vibe, large windows with city view',
  'Close-up of hands typing on mechanical keyboard with RGB backlight, coding screen in background, bokeh effect, night atmosphere',
  'Futuristic digital classroom with holographic displays showing code, teal and cyan ambient lighting, sleek modern furniture',
  'Award certificate on wooden desk with laptop, teal branding elements, professional office background, soft natural lighting',
  'Abstract technology network visualization with connected nodes, glowing cyan data streams, dark background, matrix-like aesthetic',
  'Modern campus building entrance with glass facade, students walking, sunny day, clean architecture, aspirational atmosphere',
  'Stylized 3D abstract shapes in teal and cyan, floating geometric forms, soft gradients, modern design aesthetic, clean composition',
  'Night city skyline viewed from modern office window, warm amber city lights, laptop silhouette on desk, ambient glow',
  'Diverse group of students working on laptops at modern co-working space, warm lighting, plants, collaborative atmosphere',
  'Digital neural network visualization with glowing cyan synapses, dark background, technological aesthetic, abstract intelligence',
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

async function renderHtml(html, format = 'landscape') {
  const size = format === 'portrait' ? { width: 1080, height: 1350 } : format === 'reel' ? { width: 1080, height: 1920 } : { width: 1200, height: 630 };
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  const fullHtml = html.includes('<html') ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&family=Space+Mono:wght@700&family=Press+Start+2P&family=DM+Sans:wght@500;700;800&family=Sora:wght@500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{width:${size.width}px;height:${size.height}px;overflow:hidden;}</style></head><body>${html}</body></html>`;
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

async function generateFluxBackground({ post, meta, apiKey, format = 'landscape', index = 0 }) {
  const portrait = format === 'portrait';
  const seed = [...(meta.headline || 'devcraft')].reduce((a, c) => a + c.charCodeAt(0), 0) % 1000000;
  const prompt = buildFluxPrompt(post, meta, portrait, index);
  const width = portrait ? 1024 : 1200;
  const height = portrait ? 1280 : 630;
  const body = { prompt, mode: 'base', cfg_scale: 5, width, height, seed, steps: 24 };

  const res = await fetch('https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`FLUX ${res.status}: ${err.slice(0, 120)}`);
  }
  const json = await res.json();
  const b64 = json?.artifacts?.[0]?.base64;
  if (!b64) throw new Error('FLUX returned no image');
  const buf = Buffer.from(b64, 'base64');
  console.log(`[IMAGE] FLUX background (${width}x${height}): ${buf.length} bytes`);
  return buf;
}

function buildFluxPrompt(post, meta, portrait = false, index = 0) {
  const hotTake = (post || '').split('\n').find(l => l.trim().length > 40) || meta.subtext;
  const tail = portrait
    ? ', vertical 9:16 portrait composition, photorealistic, cinematic lighting, deep depth of field, moody dark tones, professional architectural or nature photography, high detail, no text, no letters, no watermark'
    : ', photorealistic, cinematic lighting, deep depth of field, vibrant teal, cyan and warm amber accents, high quality 1200x630 banner, professional marketing photography, no text, no letters, no watermark';
  const scene = portrait
    ? [
        'minimalist brutalist concrete architecture at dusk, dramatic long shadows, dark moody sky, warm light glowing from a single window, cinematic photography',
        'lush dark green forest with low morning fog and soft god rays breaking through the canopy, deep shadows, cinematic nature photography',
        'modern glass skyscraper facade photographed straight up at night, mirror reflections, teal and navy city lights, architectural photography',
        'mountain peaks at blue hour under a deep navy sky, faint stars, cinematic moody landscape photography',
        'geometric concrete spiral staircase, dramatic low-key lighting, dark brutalist architecture, long exposure',
        'calm dark ocean at night under moonlight, deep navy and black tones, long exposure, minimal and serene',
        'grand historic library reading hall, perfect symmetry, warm lamp light, dark wood, moody architectural interior photography',
        'minimalist courtyard with a single tree and clean concrete walls, evening light, dark green and amber tones, architectural design photography',
      ]
    : [
        'modern startup office at dusk, young engineers collaborating around laptops and a large code dashboard on glowing screens, teal and amber ambient light',
        'tier-2 Indian engineering college campus, confident final-year students walking with laptops, warm golden evening light, aspirational mood',
        'close-up of a data-science student building a dashboard on a laptop, holographic charts floating above the screen, cyan glow',
        'futuristic virtual internship briefing room, big holographic project roadmap, Indian mentors pointing at a roadmap wall, cyan and orange holograms',
        'night campus library bench, laptop showing code, coffee cup, quiet focused student, warm city glow through window',
        'developer celebrating a deployed project, confetti on monitor, sleek desk setup, warm amber keyboard backlight, joyful',
      ];
  const seed = [...(meta.headline || 'devcraft')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const prompt = `${scene[(seed + index) % scene.length]}, ${tail}`;
  return prompt;
}

function buildPortraitFluxHtml(fluxBase64, meta) {
  const b64 = fluxBase64.replace(/^data:image\/\w+;base64,/, '');
  const bgDataUri = `data:image/jpeg;base64,${b64}`;
  const site = meta.site || 'devcraft.fennark.xyz';
  const benefits = [
    { t: 'Real industry projects', s: 'Python · DSA · Web · AI/ML' },
    { t: 'Offer letter + verified certificate', s: 'Instant, live-verified' },
    { t: 'Mentorship from engineers', s: 'Portfolio you can show' },
    { t: 'MSME-registered program', s: '10,000+ learners' },
  ];
  const benefitRow = benefits.map((b, i) => `
    <div style="display:flex;align-items:flex-start;gap:20px;padding:16px 0;border-top:1px solid rgba(255,255,255,0.12);">
      <div style="width:44px;height:44px;min-width:44px;border-radius:50%;background:linear-gradient(135deg,#14b8a6,#38bdf8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;box-shadow:0 4px 12px rgba(56,189,248,0.4);">${i + 1}</div>
      <div>
        <div style="font-size:22px;font-weight:700;color:#fff;">${b.t}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.6);font-weight:400;">${b.s}</div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;font-family:'Inter',sans-serif}
.bg{position:absolute;inset:0;background:url('${bgDataUri}') center/cover no-repeat;filter:brightness(0.78)}
.scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,10,18,0.6) 0%,rgba(4,10,18,0.18) 22%,rgba(4,10,18,0.66) 55%,rgba(5,9,16,0.97) 100%)}
.top{position:absolute;top:0;left:0;right:0;padding:30px 50px;display:flex;align-items:center;justify-content:space-between}
.brand{background:rgba(5,10,18,0.72);border:1px solid rgba(255,255,255,0.22);backdrop-filter:blur(4px);padding:10px 22px;border-radius:10px;font-size:20px;font-weight:800;color:#fff;letter-spacing:3px}
.brand em{font-style:normal;color:#2dd4bf}
.flag{font-size:12px;font-weight:600;color:#fff;background:#f97316;padding:8px 14px;border-radius:6px;letter-spacing:1px}
.content{position:absolute;inset:0;padding:150px 54px 44px;display:flex;flex-direction:column;justify-content:flex-end}
.eyebrow{font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#5eead4;margin-bottom:18px}
.headline{font-size:62px;font-weight:900;color:#fff;line-height:1.06;margin-bottom:24px;text-shadow:0 4px 30px rgba(0,0,0,0.6);letter-spacing:-0.5px}
.subtext{font-size:23px;color:rgba(255,255,255,0.84);line-height:1.5;margin-bottom:30px;max-width:94%;font-weight:400}
.checks{border-bottom:1px solid rgba(255,255,255,0.12);margin-bottom:26px}
.cta{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#f97316,#f59e0b);border-radius:16px;padding:24px 28px;box-shadow:0 10px 40px rgba(249,115,22,0.4)}
.cta .label{font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:1.5px}
.cta .url{font-size:25px;font-weight:800;color:#fff;letter-spacing:0.3px}
.cta .arrow{width:46px;height:46px;min-width:46px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff}
.social{margin-top:20px;display:flex;align-items:center;justify-content:space-between;font-size:14px;color:rgba(255,255,255,0.62);font-weight:500}
.social b{color:#2dd4bf;font-weight:700}
</style></head><body>
<div class="bg"></div>
<div class="scrim"></div>
<div class="top"><span class="brand">DEV<em>/</em>CRAFT</span><span class="flag">APPLY NOW</span></div>
<div class="content">
  <div class="eyebrow">VIRTUAL INTERNSHIP &bull; 2026</div>
  <div class="headline">${meta.headline}</div>
  <div class="subtext">${meta.subtext}</div>
  <div class="checks">${benefitRow}</div>
  <div class="cta">
    <span class="label">Apply at</span>
    <span class="url">${site}</span>
    <span class="arrow">&rarr;</span>
  </div>
  <div class="social"><span><b>10,000+ learners</b> &bull; 300+ colleges</span><span><b>MSME</b>-registered</span></div>
</div>
</body></html>`;
}

async function generateFluxPortrait({ post, meta, apiKey }) {
  const flux = await generateFluxBackground({ post, meta, apiKey, format: 'portrait' });
  const b64 = flux.toString('base64');
  const html = buildPortraitFluxHtml(b64, { site: 'devcraft.fennark.xyz', ...meta });
  const buf = await renderHtml(html, 'portrait');
  console.log(`[IMAGE] FLUX portrait composite: ${buf.length} bytes`);
  return buf;
}

export function buildReelFluxHtml(fluxBase64, m, index) {
  const b64 = fluxBase64.replace(/^data:image\/\w+;base64,/, '');
  const bgDataUri = `data:image/jpeg;base64,${b64}`;
  const site = m.site || 'devcraft.fennark.xyz';
  const song = m.song || 'Now playing — trending right now';
  const accentSets = [
    ['#22d3ee', '#a855f7'],
    ['#f97316', '#f59e0b'],
    ['#06b6d4', '#22d3ee'],
  ];
  const [a1, a2] = accentSets[index % accentSets.length];

  const benefits = [
    { t: 'Real industry projects', s: 'Python · DSA · Web · AI/ML' },
    { t: 'Offer letter + verified certificate', s: 'Instant, live-verified' },
    { t: 'Mentorship from engineers', s: 'Portfolio you can show' },
    { t: 'MSME-registered program', s: '10,000+ learners' },
  ];
  const benefitRow = benefits.map((b, i) => `
    <div style="display:flex;align-items:center;gap:26px;padding:26px 30px;border-radius:22px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(12px);box-shadow:0 10px 34px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.08);">
      <div style="width:60px;height:60px;min-width:60px;border-radius:18px;background:linear-gradient(135deg,${a1},${a2});display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;box-shadow:0 10px 26px rgba(0,0,0,0.45);">${i + 1}</div>
      <div>
        <div style="font-size:28px;font-weight:700;color:#fff;">${b.t}</div>
        <div style="font-size:18px;color:rgba(255,255,255,0.58);font-weight:400;margin-top:3px;">${b.s}</div>
      </div>
    </div>`).join('');

  const ctaStrip = `
    <div style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,${a1},${a2});border-radius:24px;padding:28px 32px;box-shadow:0 20px 54px rgba(0,0,0,0.55),0 6px 24px rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);">
      <span style="font-size:16px;font-weight:700;color:rgba(255,255,255,0.95);text-transform:uppercase;letter-spacing:2px;">Apply at</span>
      <span style="font-size:32px;font-weight:800;color:#fff;letter-spacing:0.3px;">${site}</span>
      <span style="width:62px;height:62px;min-width:62px;border-radius:50%;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff;">&rarr;</span>
    </div>`;

  const songPill = `
    <div style="display:flex;align-items:center;gap:14px;justify-content:center;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:18px 30px;backdrop-filter:blur(10px);">
      <span style="font-size:26px;">&#127925;</span><span style="font-size:21px;color:rgba(255,255,255,0.85);font-weight:600;">${song}</span>
    </div>`;

  const socialRow = `
    <div style="display:flex;align-items:center;justify-content:space-between;font-size:18px;color:rgba(255,255,255,0.55);font-weight:500;">
      <span style="color:#22d3ee;font-weight:700;">10,000+ learners</span><span style="color:#22d3ee;font-weight:700;">MSME-registered</span>
    </div>`;

  const header = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 2px;">
      <span style="font-size:30px;font-weight:800;color:#fff;letter-spacing:2px;">DEV<span style="color:#22d3ee;">/</span>CRAFT</span>
      <span style="font-size:15px;font-weight:600;color:#fff;background:linear-gradient(135deg,#f97316,#f59e0b);padding:13px 28px;border-radius:999px;box-shadow:0 10px 28px rgba(249,115,22,0.5);letter-spacing:1px;">APPLY NOW</span>
    </div>`;

  const coverBody = `
    <div style="display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:17px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#5eead4;margin-bottom:28px;">Virtual Internship &bull; 2026</div>
      <div style="font-size:84px;font-weight:800;color:#fff;line-height:1.05;letter-spacing:-1.5px;text-shadow:0 10px 44px rgba(0,0,0,0.6);">${m.headline}</div>
      <div style="width:150px;height:8px;border-radius:4px;background:linear-gradient(90deg,${a1},${a2});margin:32px 0;box-shadow:0 4px 18px rgba(0,0,0,0.5);"></div>
      <div style="font-size:28px;color:rgba(255,255,255,0.84);line-height:1.5;max-width:96%;font-weight:400;">${m.subtext}</div>
    </div>
    <div style="margin-top:30px;">${ctaStrip}</div>`;

  const benefitsBody = `
    <div style="margin-bottom:26px;">
      <div style="font-size:17px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#5eead4;margin-bottom:18px;">What You Get</div>
      <div style="font-size:56px;font-weight:800;color:#fff;line-height:1.08;letter-spacing:-1px;text-shadow:0 8px 34px rgba(0,0,0,0.55);">${m.headline}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;margin-bottom:30px;">${benefitRow}</div>
    ${ctaStrip}`;

  const proofBody = `
    <div style="margin-bottom:26px;">
      <div style="font-size:17px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#5eead4;margin-bottom:18px;">Proof, Not Promises</div>
      <div style="font-size:56px;font-weight:800;color:#fff;line-height:1.08;letter-spacing:-1px;text-shadow:0 8px 34px rgba(0,0,0,0.55);">${m.headline}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:30px;">
      ${[['10,000+', 'learners'], ['300+', 'colleges'], ['4.8★', 'learner rating'], ['MSME', 'registered']].map(([n, l]) => `
      <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:22px;padding:30px 20px;text-align:center;backdrop-filter:blur(12px);box-shadow:0 10px 34px rgba(0,0,0,0.3);">
        <div style="font-size:52px;font-weight:800;color:#fff;text-shadow:0 6px 24px rgba(0,0,0,0.5);">${n}</div>
        <div style="font-size:20px;color:rgba(255,255,255,0.62);font-weight:500;margin-top:6px;">${l}</div>
      </div>`).join('')}
    </div>
    ${songPill}
    <div style="margin-top:22px;">${ctaStrip}</div>`;

  const body = index % 3 === 1 ? benefitsBody : index % 3 === 2 ? proofBody : coverBody;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;font-family:'Sora',sans-serif}
.bg{position:absolute;inset:0;background:url('${bgDataUri}') center/cover no-repeat;filter:brightness(0.7)}
.scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,8,18,0.82) 0%,rgba(4,8,18,0.38) 30%,rgba(4,8,18,0.55) 55%,rgba(3,6,14,0.97) 100%)}
</style></head><body>
<div class="bg"></div>
<div class="scrim"></div>
<div style="position:absolute;inset:0;display:flex;flex-direction:column;padding:64px 56px 48px;">
  ${header}
  <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;">${body}</div>
</div>
</body></html>`;
}

async function generateReelFluxCard({ post, meta, apiKey, index }) {
  const flux = await generateFluxBackground({ post, meta, apiKey, format: 'portrait', index });
  const b64 = flux.toString('base64');
  const html = buildReelFluxHtml(b64, { site: 'devcraft.fennark.xyz', ...meta }, index);
  const buf = await renderHtml(html, 'reel');
  console.log(`[IMAGE] FLUX reel card #${index}: ${buf.length} bytes`);
  return buf;
}

export async function generateReelCards({ post, meta, apiKey, count = 3 }) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    try {
      cards.push(await generateReelFluxCard({ post, meta, apiKey, index: i }));
    } catch (err) {
      console.log(`[IMAGE] FLUX reel card #${i} failed, using template fallback: ${err.message}`);
      cards.push(await renderHtml(premiumReelCard(meta), 'reel'));
    }
  }
  return cards;
}

export async function generateImage({ html, post, imageMeta, designBrief, apiKey, hfToken, format = 'landscape' }) {
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

  // Portrait: prefer FLUX AI background + composite (uses NVIDIA_API_KEY)
  if (format === 'portrait' && apiKey) {
    try {
      const fluxBuf = await generateFluxPortrait({ post, meta, apiKey });
      if (fluxBuf && fluxBuf.length > 500) return fluxBuf;
    } catch (err) {
      console.log(`[IMAGE] FLUX portrait failed, falling back to template: ${err.message}`);
    }
  }

  // Fallback / reel: render a code-based modern template (fast, reliable, no API dependency)
  const templateHtml = format === 'portrait' ? portraitCard(meta) : format === 'reel' ? premiumReelCard(meta) : pickTemplate(meta);
  const buf = await renderHtml(templateHtml, format);
  console.log(`[IMAGE] Template card (${meta.style}, ${format}): ${buf.length} bytes`);
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

function portraitCard(m) {
  const site = m.site || 'devcraft.fennark.xyz';
  const benefits = [
    { t: 'Real industry projects', s: 'Python · DSA · Web · AI/ML' },
    { t: 'Offer letter + verified certificate', s: 'Instant, live-verified' },
    { t: 'Mentorship from engineers', s: 'Portfolio you can show' },
    { t: 'MSME-registered program', s: '10,000+ learners' },
  ];
  const benefitRow = benefits.map((b, i) => `
    <div style="display:flex;align-items:flex-start;gap:20px;padding:18px 0;border-top:1px solid rgba(255,255,255,0.14);">
      <div style="width:46px;height:46px;min-width:46px;border-radius:50%;background:linear-gradient(135deg,#14b8a6,#38bdf8);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#fff;box-shadow:0 4px 12px rgba(56,189,248,0.4);">${i + 1}</div>
      <div>
        <div style="font-size:23px;font-weight:700;color:#fff;">${b.t}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.6);font-weight:400;">${b.s}</div>
      </div>
    </div>`).join('');

  return `<div style="width:1080px;height:1350px;background:linear-gradient(180deg,#081220 0%,#0c1a2e 55%,#050b14 100%);font-family:'Inter',sans-serif;position:relative;overflow:hidden;display:flex;flex-direction:column;">
    <div style="position:absolute;top:-160px;right:-160px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(20,184,166,0.28),transparent 70%);"></div>
    <div style="position:absolute;bottom:-120px;left:-120px;width:440px;height:440px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,0.2),transparent 70%);"></div>
    <div style="position:relative;padding:42px 48px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:24px;font-weight:800;color:#fff;letter-spacing:3px;">DEV<em style="font-style:normal;color:#2dd4bf;">/</em>CRAFT</span>
      <span style="font-size:12px;font-weight:600;color:#fff;background:#f97316;padding:8px 14px;border-radius:6px;letter-spacing:1px;">APPLY NOW</span>
    </div>
    <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;padding:30px 54px;">
      <div style="font-size:15px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#5eead4;margin-bottom:20px;">VIRTUAL INTERNSHIP &bull; 2026</div>
      <div style="font-size:64px;font-weight:900;color:#fff;line-height:1.06;margin-bottom:26px;letter-spacing:-0.5px;">${m.headline}</div>
      <div style="width:80px;height:6px;background:linear-gradient(90deg,#14b8a6,#38bdf8);border-radius:3px;margin-bottom:26px;"></div>
      <div style="font-size:24px;color:rgba(255,255,255,0.84);line-height:1.5;max-width:92%;font-weight:400;margin-bottom:34px;">${m.subtext}</div>
      <div style="border-bottom:1px solid rgba(255,255,255,0.14);margin-bottom:26px;">${benefitRow}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#f97316,#f59e0b);border-radius:16px;padding:22px 26px;box-shadow:0 10px 40px rgba(249,115,22,0.4);">
        <span style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);text-transform:uppercase;letter-spacing:1.5px;">Apply at</span>
        <span style="font-size:25px;font-weight:800;color:#fff;">${site}</span>
        <span style="width:46px;height:46px;min-width:46px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;">&rarr;</span>
      </div>
      <div style="margin-top:20px;display:flex;align-items:center;justify-content:space-between;font-size:14px;color:rgba(255,255,255,0.62);font-weight:500;">
        <span style="color:#2dd4bf;font-weight:700;">10,000+ learners</span><span style="color:#2dd4bf;font-weight:700;">MSME-registered</span>
      </div>
    </div>
  </div>`;
}

function premiumReelCard(m) {
  const site = m.site || 'devcraft.fennark.xyz';
  const benefits = [
    { t: 'Real industry projects', s: 'Python · DSA · Web · AI/ML' },
    { t: 'Offer letter + verified certificate', s: 'Instant, live-verified' },
    { t: 'Mentorship from engineers', s: 'Portfolio you can show' },
    { t: 'MSME-registered program', s: '10,000+ learners' },
  ];
  const benefitRow = benefits.map((b, i) => `
    <div style="display:flex;align-items:center;gap:26px;padding:26px 30px;border-radius:22px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(12px);box-shadow:0 10px 34px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.08);">
      <div style="width:60px;height:60px;min-width:60px;border-radius:18px;background:linear-gradient(135deg,#22d3ee,#a855f7);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;box-shadow:0 10px 26px rgba(168,85,247,0.45);">${i + 1}</div>
      <div>
        <div style="font-size:28px;font-weight:700;color:#fff;">${b.t}</div>
        <div style="font-size:18px;color:rgba(255,255,255,0.58);font-weight:400;margin-top:3px;">${b.s}</div>
      </div>
    </div>`).join('');

  return `<div style="width:1080px;height:1920px;background:linear-gradient(180deg,#070a18 0%,#0b1126 45%,#05070f 100%);font-family:'Sora',sans-serif;position:relative;overflow:hidden;display:flex;flex-direction:column;padding:64px 56px 48px;">
    <div style="position:absolute;top:-220px;right:-160px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,0.32),transparent 65%);filter:blur(14px);"></div>
    <div style="position:absolute;top:520px;left:-240px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,rgba(168,85,247,0.26),transparent 65%);filter:blur(16px);"></div>
    <div style="position:absolute;bottom:-200px;right:-140px;width:660px;height:660px;border-radius:50%;background:radial-gradient(circle,rgba(20,184,166,0.28),transparent 65%);filter:blur(14px);"></div>
    <div style="position:absolute;inset:0;opacity:0.05;background-image:linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px);background-size:72px 72px;"></div>
    <div style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:6px 2px;">
      <span style="font-size:30px;font-weight:800;color:#fff;letter-spacing:2px;">DEV<span style="color:#22d3ee;">/</span>CRAFT</span>
      <span style="font-size:15px;font-weight:600;color:#fff;background:linear-gradient(135deg,#f97316,#f59e0b);padding:13px 28px;border-radius:999px;box-shadow:0 10px 28px rgba(249,115,22,0.5);letter-spacing:1px;">APPLY NOW</span>
    </div>
    <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-size:17px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#5eead4;margin-bottom:30px;">Virtual Internship &bull; 2026</div>
      <div style="font-size:86px;font-weight:800;color:#fff;line-height:1.05;letter-spacing:-1.5px;text-shadow:0 10px 44px rgba(0,0,0,0.55);">${m.headline}</div>
      <div style="width:150px;height:8px;border-radius:4px;background:linear-gradient(90deg,#22d3ee,#a855f7,#f97316);margin:34px 0;box-shadow:0 4px 18px rgba(168,85,247,0.5);"></div>
      <div style="font-size:28px;color:rgba(255,255,255,0.82);line-height:1.5;max-width:96%;font-weight:400;">${m.subtext}</div>
    </div>
    <div style="position:relative;display:flex;flex-direction:column;gap:18px;margin-bottom:38px;">${benefitRow}</div>
    <div style="position:relative;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#7c3aed,#06b6d4);border-radius:24px;padding:30px 34px;box-shadow:0 20px 54px rgba(124,58,237,0.5),0 6px 24px rgba(6,182,212,0.35);border:1px solid rgba(255,255,255,0.14);">
      <span style="font-size:16px;font-weight:600;color:rgba(255,255,255,0.92);text-transform:uppercase;letter-spacing:2px;">Apply at</span>
      <span style="font-size:32px;font-weight:800;color:#fff;letter-spacing:0.3px;">${site}</span>
      <span style="width:62px;height:62px;min-width:62px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff;">&rarr;</span>
    </div>
    <div style="position:relative;margin-top:26px;display:flex;align-items:center;gap:14px;justify-content:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:999px;padding:18px 30px;backdrop-filter:blur(10px);">
      <span style="font-size:26px;">&#127925;</span>
      <span style="font-size:21px;color:rgba(255,255,255,0.85);font-weight:600;">${m.song || 'Now playing — trending right now'}</span>
    </div>
    <div style="position:relative;margin-top:26px;display:flex;align-items:center;justify-content:space-between;font-size:18px;color:rgba(255,255,255,0.55);font-weight:500;">
      <span style="color:#22d3ee;font-weight:700;">10,000+ learners</span><span style="color:#22d3ee;font-weight:700;">MSME-registered</span>
    </div>
  </div>`;
}

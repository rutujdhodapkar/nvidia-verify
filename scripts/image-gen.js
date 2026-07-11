import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const CARD_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: 'Inter', Arial, sans-serif;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  display: flex; align-items: center; justify-content: center; padding: 40px; }
.card { width: 100%; height: 100%; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 24px;
  padding: 50px; display: flex; flex-direction: column; justify-content: space-between;
  backdrop-filter: blur(10px); position: relative; overflow: hidden; }
.badge { display: inline-block; background: linear-gradient(90deg, #6366f1, #8b5cf6);
  color: #fff; padding: 8px 20px; border-radius: 100px; font-size: 14px;
  font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; width: fit-content; }
.content { flex: 1; display: flex; flex-direction: column; justify-content: center;
  gap: 20px; }
.headline { font-size: 40px; font-weight: 800; color: #ffffff;
  line-height: 1.2; max-width: 90%; }
.subtext { font-size: 22px; color: rgba(255,255,255,0.7); line-height: 1.4; }
.stats { display: flex; gap: 40px; margin-top: 10px; }
.stat-item { text-align: left; }
.stat-num { font-size: 36px; font-weight: 800; color: #8b5cf6; }
.stat-label { font-size: 14px; color: rgba(255,255,255,0.5); text-transform: uppercase;
  letter-spacing: 0.5px; margin-top: 2px; }
.footer { display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; }
.logo { font-size: 24px; font-weight: 900; color: #fff; }
.logo span { color: #8b5cf6; }
.url { font-size: 14px; color: rgba(255,255,255,0.4); }
.decor { position: absolute; top: -100px; right: -100px; width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; }
.decor2 { position: absolute; bottom: -60px; left: -60px; width: 250px; height: 250px;
  background: radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; }
</style></head><body>
<div class="card">
  <div class="decor"></div><div class="decor2"></div>
  <div class="badge">100% Free Virtual Internship</div>
  <div class="content">
    <div class="headline">{{HEADLINE}}</div>
    <div class="subtext">{{SUBTEXT}}</div>
    <div class="stats">
      <div class="stat-item"><div class="stat-num">{{STAT1_NUM}}</div><div class="stat-label">{{STAT1_LABEL}}</div></div>
      <div class="stat-item"><div class="stat-num">{{STAT2_NUM}}</div><div class="stat-label">{{STAT2_LABEL}}</div></div>
      <div class="stat-item"><div class="stat-num">{{STAT3_NUM}}</div><div class="stat-label">{{STAT3_LABEL}}</div></div>
    </div>
  </div>
  <div class="footer">
    <div class="logo">DEV<span>/</span>CRAFT</div>
    <div class="url">devcraft.fennark.xyz</div>
  </div>
</div></body></html>`;

export async function generateImageCard({ headline, subtext, stats }) {
  const html = CARD_HTML
    .replace('{{HEADLINE}}', headline || 'Build Real Projects. Get Certified.')
    .replace('{{SUBTEXT}}', subtext || 'Free virtual internships for college students with real-world experience.')
    .replace('{{STAT1_NUM}}', stats?.[0]?.num || '100%')
    .replace('{{STAT1_LABEL}}', stats?.[0]?.label || 'Free')
    .replace('{{STAT2_NUM}}', stats?.[1]?.num || '24/7')
    .replace('{{STAT2_LABEL}}', stats?.[1]?.label || 'Self-Paced')
    .replace('{{STAT3_NUM}}', stats?.[2]?.num || 'Now')
    .replace('{{STAT3_LABEL}}', stats?.[2]?.label || 'Enroll Open');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const buffer = await page.screenshot({ type: 'png' });
  await browser.close();
  return buffer;
}

export async function generateImageNvidia(post, apiKey) {
  const prompt = `Professional LinkedIn banner for a free virtual internship platform for college students. Clean, modern design. Text overlay: "${post.slice(0, 100)}"`;

  const res = await fetch('https://ai.api.nvidia.com/v1/vlm/playground-v2.5', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      width: 1200,
      height: 630,
      negative_prompt: 'text, watermark, blurry, low quality',
      num_inference_steps: 25,
    }),
  });

  if (!res.ok) {
    console.log('[IMAGE] NVIDIA image gen failed, falling back to HTML card');
    return null;
  }

  const data = await res.json();
  if (data?.image) {
    const base64 = data.image.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }
  return null;
}

if (process.argv[1]?.endsWith('image-gen.js')) {
  const buf = await generateImageCard({
    headline: 'Kickstart Your Dev Career',
    subtext: '100% free virtual internships — real projects, real certificates.',
    stats: [
      { num: '100%', label: 'Free' },
      { num: '24/7', label: 'Self-Paced' },
      { num: 'Now', label: 'Enroll Open' },
    ],
  });
  console.log(`Image generated: ${buf.length} bytes`);
}

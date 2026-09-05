import { chromium } from 'playwright';

export const THEMES = [
  // Swiss / International Typographic Style — clean grid, bold typography, high contrast
  { name: 'swiss-black', bg: '#000000', accent: '#FFFFFF', pop: '#FF0000', text: '#FFFFFF', texture: 'none', light: false, font: 'Helvetica Neue, Helvetica, Arial, sans-serif', weights: ['700', '500', '400'] },
  { name: 'swiss-white', bg: '#FFFFFF', accent: '#000000', pop: '#FF0000', text: '#000000', texture: 'none', light: true, font: 'Helvetica Neue, Helvetica, Arial, sans-serif', weights: ['700', '500', '400'] },
  { name: 'swiss-red-grid', bg: '#FFFFFF', accent: '#000000', pop: '#FF0000', text: '#000000', texture: 'grid', light: true, font: 'Helvetica Neue, Helvetica, Arial, sans-serif', weights: ['700', '500', '400'] },
  { name: 'swiss-blue-grid', bg: '#0A0A0A', accent: '#FFFFFF', pop: '#0066FF', text: '#FFFFFF', texture: 'grid', light: false, font: 'Helvetica Neue, Helvetica, Arial, sans-serif', weights: ['700', '500', '400'] },
  // Legacy themes (kept for rotation fallback)
  { name: 'void-violet', bg: '#0A0A0F', accent: '#7C3AED', pop: '#C4F000', text: '#FAFAF7', texture: 'shape', light: false, font: 'Unbounded' },
  { name: 'signal-coral', bg: '#1A0E0E', accent: '#FF5A5F', pop: '#FFD166', text: '#FFF5F0', texture: 'grain', light: false, font: 'Archivo Black' },
  { name: 'terminal-green', bg: '#0D1117', accent: '#39FF14', pop: '#58A6FF', text: '#E6EDF3', texture: 'halftone', light: false, font: 'Space Grotesk' },
  { name: 'paper-cream', bg: '#F5F0E8', accent: '#1A1A2E', pop: '#E8603C', text: '#1A1A2E', texture: 'grain', light: true, font: 'Bricolage Grotesque' },
  { name: 'cyber-cyan', bg: '#060B14', accent: '#00D9FF', pop: '#FF3EA5', text: '#F0FBFF', texture: 'halftone', light: false, font: 'Sora' },
  { name: 'sunset-grad', bg: 'linear-gradient(135deg,#2D1B4E 0%,#B83280 55%,#FF7849 100%)', accent: '#FF7849', pop: '#FFE45E', text: '#FFF9F0', texture: 'mesh', light: false, font: 'Bricolage Grotesque' },
  { name: 'mint-forest', bg: '#08100D', accent: '#34D399', pop: '#FBBF24', text: '#ECFDF5', texture: 'shape', light: false, font: 'Space Grotesk' },
  { name: 'royal-gold', bg: '#0B1026', accent: '#F5C518', pop: '#7C8CF8', text: '#F8FAFF', texture: 'halftone', light: false, font: 'Sora' },
  { name: 'rose-quartz', bg: '#FDEAF0', accent: '#B23A6B', pop: '#FF7A9E', text: '#2B1620', texture: 'grain', light: true, font: 'Unbounded' },
  { name: 'ocean-storm', bg: 'linear-gradient(135deg,#04293A 0%,#0F5E7A 60%,#1CB0B9 100%)', accent: '#7EE8FA', pop: '#FF6B6B', text: '#F0FEFF', texture: 'mesh', light: false, font: 'Archivo Black' },
  { name: 'neo-mint', bg: '#07211C', accent: '#2DD4BF', pop: '#FDE68A', text: '#ECFDF5', texture: 'shape', light: false, font: 'Sora' },
  { name: 'cocoa-ember', bg: '#160D08', accent: '#F97316', pop: '#FACC15', text: '#FFF7ED', texture: 'grain', light: false, font: 'Archivo Black' },
  { name: 'blueprint', bg: '#0B2447', accent: '#A5D7E8', pop: '#FFD166', text: '#EFF6FF', texture: 'halftone', light: false, font: 'Space Grotesk' },
  { name: 'lavender-haze', bg: 'linear-gradient(135deg,#1E1B4B 0%,#6D28D9 55%,#DB2777 100%)', accent: '#F0ABFC', pop: '#FDE68A', text: '#FDF4FF', texture: 'mesh', light: false, font: 'Unbounded' },
];

export const POST_TYPE_THEME = {
  deadline: 'swiss-black',
  curriculum_highlight: 'swiss-white',
  testimonial: 'swiss-red-grid',
  stat_card: 'swiss-blue-grid',
  community: 'swiss-black',
};

export const POST_TYPE_ARCHETYPES = {
  deadline: ['swiss-banner', 'swiss-grid', 'swiss-typo-poster'],
  curriculum_highlight: ['swiss-modular', 'swiss-grid', 'swiss-typo-poster'],
  testimonial: ['swiss-quote', 'swiss-grid', 'swiss-typo-poster'],
  stat_card: ['swiss-stats', 'swiss-grid', 'swiss-typo-poster'],
  community: ['swiss-banner', 'swiss-grid', 'swiss-typo-poster'],
  default: ['swiss-modular', 'swiss-grid', 'swiss-typo-poster'],
};

const BENEFITS = [
  { t: 'Real industry projects', s: 'Python · DSA · Web · AI/ML' },
  { t: 'Instant offer letter', s: 'Live-verified certificate' },
  { t: 'Mentorship from engineers', s: 'A portfolio you can show' },
  { t: 'MSME-registered', s: '10,000+ learners' },
];

const STATS = [
  ['10,000+', 'learners'],
  ['300+', 'colleges'],
  ['4.8★', 'learner rating'],
  ['MSME', 'registered'],
];

function detectPostType(post, caption) {
  const text = `${caption || ''} ${post || ''}`.toLowerCase();
  if (/\b(deadline|spots filling|seats|closing|closes|last date|hurry|limited)\b/.test(text)) return 'deadline';
  if (/\b(curriculum|python|dsa|web dev|ai\/ml|project|build)\b/.test(text)) return 'curriculum_highlight';
  if (/\b(hostel|student|story|felt|parent|mother|dad|first)\b/.test(text)) return 'testimonial';
  if (/\b(10,000|300\+|learners|colleges|msme|rating|numbers|proof)\b/.test(text)) return 'stat_card';
  return 'community';
}

export function pickThemeForPost(postType, previousTheme) {
  // Strict rotation: always use a DIFFERENT theme than the previous post.
  // Cycles through all themes so every post gets a fresh look (never alternates between 2).
  const pref = POST_TYPE_THEME[postType] || THEMES[0].name;
  if (!previousTheme) {
    const startIdx = Math.max(0, THEMES.findIndex(t => t.name === pref));
    return THEMES[startIdx % THEMES.length];
  }
  const prevIdx = THEMES.findIndex(t => t.name === previousTheme);
  const nextIdx = prevIdx >= 0 ? (prevIdx + 1) % THEMES.length : 0;
  return THEMES[nextIdx];
}

function grainOverlay(light) {
  return `<div style="position:absolute;inset:0;pointer-events:none;opacity:0.06;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");"></div>`;
}

function halftoneOverlay(accent) {
  return `<div style="position:absolute;inset:0;pointer-events:none;opacity:0.08;background-image:radial-gradient(circle,${accent} 1.5px,transparent 1.6px);background-size:22px 22px;"></div>`;
}

function shapeOverlay(accent) {
  return `<div style="position:absolute;top:-260px;right:-260px;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,${accent}55,transparent 68%);pointer-events:none;"></div><div style="position:absolute;top:340px;right:-260px;width:560px;height:560px;transform:rotate(24deg);background:linear-gradient(135deg,${accent}33,transparent 70%);pointer-events:none;"></div>`;
}

function meshOverlay() {
  return `<div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 20% 15%,rgba(255,228,94,0.16),transparent 40%),radial-gradient(circle at 85% 70%,rgba(255,255,255,0.14),transparent 42%),radial-gradient(circle at 60% 110%,rgba(255,255,255,0.12),transparent 45%);"></div>`;
}

function gridOverlay(theme) {
  const color = theme.light ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
  return `<div style="position:absolute;inset:0;pointer-events:none;background-image:
    linear-gradient(${color} 1px, transparent 1px),
    linear-gradient(90deg, ${color} 1px, transparent 1px);
  background-size: 60px 60px;"></div>`;
}

function textureFor(theme) {
  if (theme.texture === 'halftone') return halftoneOverlay(theme.accent);
  if (theme.texture === 'mesh') return meshOverlay();
  if (theme.texture === 'shape') return shapeOverlay(theme.accent);
  if (theme.texture === 'grid') return gridOverlay(theme);
  return grainOverlay(theme.light);
}

function displayFont(theme) {
  return `font-family:'${theme.font}',sans-serif;`;
}

function wordmark(theme) {
  return `<div style="position:absolute;top:52px;left:56px;display:flex;align-items:center;gap:12px;z-index:5;">
    <span style="${displayFont(theme)}font-weight:700;font-size:26px;letter-spacing:2px;color:${theme.text};">DEV<span style="color:${theme.accent};">/</span>CRAFT</span>
    <span style="width:6px;height:6px;border-radius:50%;background:${theme.pop};"></span>
  </div>`;
}

function ctaPill(theme, link) {
  const display = (link || 'devcraft.fennark.xyz').replace(/^https?:\/\//, '');
  return `<div style="position:absolute;left:56px;bottom:48px;z-index:5;display:inline-flex;align-items:center;gap:14px;padding:22px 30px;border-radius:999px;background:${theme.pop};color:${theme.light ? '#111' : '#050505'};box-shadow:0 14px 40px rgba(0,0,0,0.4);">
    <span style="${displayFont(theme)}font-weight:700;font-size:24px;letter-spacing:0.5px;">${display} ↗</span>
  </div>`;
}

function headlineSize(text) {
  const n = (text || '').split(/\s+/).length;
  if (n <= 3) return '104px';
  if (n <= 5) return '92px';
  if (n <= 7) return '78px';
  return '62px';
}

function subheadlineSize(text) {
  const n = (text || '').split(/\s+/).length;
  if (n <= 4) return '64px';
  return '54px';
}

function kicker(theme, label) {
  return `<div style="font-family:'Instrument Serif',serif;font-style:italic;font-size:30px;color:${theme.accent};letter-spacing:0.5px;">${label}</div>`;
}

function bodyText(theme, text, size) {
  return `<div style="font-family:'Inter',sans-serif;font-weight:400;font-size:${size || '24px'};line-height:1.45;color:${theme.text};opacity:0.78;">${text}</div>`;
}

function benefitRows(theme) {
  return BENEFITS.map(b => `
    <div style="display:flex;align-items:flex-start;gap:22px;padding:24px 0;border-top:1px solid ${theme.light ? 'rgba(26,26,46,0.14)' : 'rgba(255,255,255,0.12)'};">
      <div style="width:52px;height:52px;min-width:52px;border-radius:14px;background:${theme.accent};display:flex;align-items:center;justify-content:center;${displayFont(theme)}font-weight:700;font-size:24px;color:${theme.light ? '#fff' : '#050505'};">${BENEFITS.indexOf(b) + 1}</div>
      <div>
        <div style="${displayFont(theme)}font-weight:700;font-size:26px;color:${theme.text};">${b.t}</div>
        <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:18px;color:${theme.text};opacity:0.6;margin-top:2px;">${b.s}</div>
      </div>
    </div>`).join('');
}

function statGrid(theme) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;width:100%;">
    ${STATS.map(([n, l]) => `
    <div style="padding:30px 18px;border-radius:20px;background:${theme.light ? 'rgba(26,26,46,0.05)' : 'rgba(255,255,255,0.07)'};border:1px solid ${theme.light ? 'rgba(26,26,46,0.12)' : 'rgba(255,255,255,0.12)'};text-align:center;">
      <div style="${displayFont(theme)}font-weight:700;font-size:56px;color:${theme.accent};line-height:1;">${n}</div>
      <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:18px;color:${theme.text};opacity:0.65;margin-top:8px;">${l}</div>
    </div>`).join('')}
  </div>`;
}

function songLine(theme, song) {
  if (!song) return '';
  return `<div style="display:inline-flex;align-items:center;gap:10px;padding:12px 22px;border-radius:999px;border:1px solid ${theme.light ? 'rgba(26,26,46,0.2)' : 'rgba(255,255,255,0.2)'};">
    <span style="font-size:20px;">🎵</span><span style="font-family:'Inter',sans-serif;font-weight:500;font-size:18px;color:${theme.text};">${song}</span>
  </div>`;
}

const SHARE_NOOK = {
  deadline: 'Spots don\u2019t wait \u2014 neither should you.',
  curriculum_highlight: 'Send this to the friend still watching tutorials.',
  testimonial: 'Tell a friend who needs to hear this.',
  stat_card: 'Numbers don\u2019t lie \u2014 share the proof.',
  community: 'Forward it to your hostel group chat.',
};

function shell(theme, inner, song, format = 'portrait') {
  const W = format === 'reel' ? 1080 : 1080;
  const H = format === 'reel' ? 1920 : 1350;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&family=Unbounded:wght@600;800&family=Archivo+Black&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Sora:wght@600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Inter',sans-serif;background:${theme.bg};color:${theme.text};position:relative;}
</style></head><body>
${textureFor(theme)}
${wordmark(theme)}
<div style="position:absolute;inset:0;padding:150px 64px 190px;">${inner}</div>
${ctaPill(theme, 'devcraft.fennark.xyz')}
${song ? `<div style="position:absolute;right:56px;bottom:60px;z-index:5;">${songLine(theme, song)}</div>` : ''}
</body></html>`;
}

function diagonalSlab(theme, meta, mode) {
  const h = meta.headline;
  const size = headlineSize(h);
  const inner = mode === 'benefits'
    ? `<div style="width:78%;"><div style="${displayFont(theme)}font-weight:700;font-size:${subheadlineSize(h)};line-height:1.0;color:${theme.text};">${h}</div><div style="margin-top:34px;">${benefitRows(theme)}</div></div>`
    : mode === 'stats'
      ? `<div style="width:86%;"><div style="${displayFont(theme)}font-weight:700;font-size:${subheadlineSize(h)};line-height:1.0;color:${theme.text};margin-bottom:36px;">${h}</div>${statGrid(theme)}</div>`
      : `<div style="width:82%;"><div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:1.0;letter-spacing:-1px;color:${theme.text};">${h}</div><div style="margin-top:30px;">${bodyText(theme, meta.subtext)}</div></div>`;
  return `${kicker(theme, 'VIRTUAL INTERNSHIP · 2026')}
<div style="position:relative;margin-top:30px;display:flex;flex-direction:column;gap:28px;">${inner}</div>`;
}

function splitScreen(theme, meta, mode) {
  const h = meta.headline;
  const size = headlineSize(h);
  const right = mode === 'benefits'
    ? `<div style="display:flex;flex-direction:column;gap:8px;">${BENEFITS.slice(0, 3).map(b => `<div style="${displayFont(theme)}font-weight:700;font-size:26px;color:${theme.text};padding:18px 0;border-bottom:1px solid ${theme.light ? 'rgba(26,26,46,0.15)' : 'rgba(255,255,255,0.15)'};">${b.t}</div>`).join('')}</div>`
    : mode === 'stats'
      ? statGrid(theme)
      : `<div style="font-family:'Inter',sans-serif;font-weight:400;font-size:26px;line-height:1.5;color:${theme.text};opacity:0.85;">${meta.subtext}</div>`;
  return `<div style="display:flex;gap:56px;height:100%;align-items:center;">
  <div style="flex:1.2;display:flex;flex-direction:column;gap:24px;">
    ${kicker(theme, 'VIRTUAL INTERNSHIP · 2026')}
    <div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:1.0;letter-spacing:-1px;color:${theme.text};">${h}</div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;gap:26px;">${right}</div>
</div>`;
}

function framedCenter(theme, meta, mode) {
  const h = meta.headline;
  const inner = mode === 'benefits'
    ? `<div style="display:flex;flex-direction:column;gap:6px;">${benefitRows(theme)}</div>`
    : mode === 'stats'
      ? statGrid(theme)
      : `<div style="font-family:'Inter',sans-serif;font-weight:400;font-size:26px;line-height:1.5;color:${theme.text};opacity:0.85;">${meta.subtext}</div>`;
  return `<div style="width:100%;height:100%;border:3px solid ${theme.accent};border-radius:28px;padding:52px 56px;display:flex;flex-direction:column;justify-content:center;gap:28px;">
  <div style="display:flex;align-items:baseline;gap:20px;"><span style="width:44px;height:3px;background:${theme.pop};"></span>${kicker(theme, 'VIRTUAL INTERNSHIP · 2026')}</div>
  <div style="${displayFont(theme)}font-weight:700;font-size:${subheadlineSize(h)};line-height:1.02;letter-spacing:-0.5px;color:${theme.text};">${h}</div>
  ${inner}
</div>`;
}

function stackedCards(theme, meta, mode) {
  const h = meta.headline;
  const rows = mode === 'stats'
    ? STATS.map(([n, l]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:26px 34px;border-radius:18px;background:${theme.light ? '#fff' : 'rgba(255,255,255,0.07)'};border:1px solid ${theme.light ? 'rgba(26,26,46,0.14)' : 'rgba(255,255,255,0.12)'};margin-bottom:16px;">
        <span style="${displayFont(theme)}font-weight:700;font-size:38px;color:${theme.accent};">${n}</span>
        <span style="font-family:'Inter',sans-serif;font-weight:400;font-size:22px;color:${theme.text};opacity:0.7;">${l}</span>
      </div>`).join('')
    : BENEFITS.slice(0, 3).map((b, i) => `
      <div style="display:flex;align-items:center;gap:26px;padding:26px 34px;border-radius:18px;background:${theme.light ? '#fff' : 'rgba(255,255,255,0.07)'};border-left:6px solid ${theme.accent};box-shadow:0 8px 28px rgba(0,0,0,0.18);margin-bottom:16px;">
        <span style="${displayFont(theme)}font-weight:700;font-size:34px;color:${theme.pop};">0${i + 1}</span>
        <div><div style="${displayFont(theme)}font-weight:700;font-size:26px;color:${theme.text};">${b.t}</div><div style="font-family:'Inter',sans-serif;font-size:17px;color:${theme.text};opacity:0.55;">${b.s}</div></div>
      </div>`).join('');
  return `<div style="display:flex;flex-direction:column;gap:14px;justify-content:center;height:100%;">
  <div style="${displayFont(theme)}font-weight:700;font-size:${subheadlineSize(h)};line-height:1.02;color:${theme.text};margin-bottom:20px;">${h}</div>
  ${rows}
</div>`;
}

function collage(theme, meta, mode) {
  const h = meta.headline;
  return `<div style="position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;">
  <div style="position:absolute;top:0;right:0;width:340px;height:340px;border-radius:50%;background:${theme.accent}33;transform:rotate(18deg);"></div>
  <div style="position:absolute;bottom:20px;left:-40px;width:260px;height:260px;background:${theme.pop}22;transform:rotate(-24deg);"></div>
  <div style="position:relative;transform:rotate(-2deg);">
    <div style="font-family:'Instrument Serif',serif;font-style:italic;font-size:34px;color:${theme.pop};">built to break out of tutorial hell</div>
    <div style="${displayFont(theme)}font-weight:700;font-size:${headlineSize(h)};line-height:0.98;letter-spacing:-1px;color:${theme.text};margin-top:20px;">${h}</div>
  </div>
  <div style="position:relative;margin-top:40px;transform:rotate(1.5deg);">${mode === 'stats' ? statGrid(theme) : bodyText(theme, meta.subtext)}</div>
  <div style="position:relative;margin-top:36px;transform:rotate(-1deg);font-family:'Instrument Serif',serif;font-style:italic;font-size:28px;color:${theme.accent};">${SHARE_NOOK[meta.post_type] || SHARE_NOOK.community}</div>
</div>`;
}

// ===== SWISS / INTERNATIONAL TYPOGRAPHIC STYLE ARCHETYPES =====

function swissBanner(theme, meta, mode) {
  const h = meta.headline;
  const size = headlineSize(h);
  const isDark = !theme.light;
  const lineColor = isDark ? '#FF0000' : '#000000';
  
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 80px;">
    <div style="width:100%;height:4px;background:${lineColor};margin-bottom:40px;"></div>
    <div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:0.95;letter-spacing:-2px;color:${theme.text};text-transform:uppercase;max-width:800px;">${h}</div>
    <div style="width:120px;height:2px;background:${theme.pop};margin:40px 0;"></div>
    <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:28px;line-height:1.5;color:${theme.text};opacity:0.7;max-width:600px;">${meta.subtext}</div>
    ${mode === 'stats' ? `<div style="margin-top:50px;width:100%;">${statGrid(theme)}</div>` : ''}
    ${mode === 'benefits' ? `<div style="margin-top:50px;width:100%;">${benefitRows(theme)}</div>` : ''}
  </div>`;
}

function swissGrid(theme, meta, mode) {
  const h = meta.headline;
  const size = headlineSize(h);
  
  if (mode === 'stats') {
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 60px;">
      <div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:1.0;letter-spacing:-1px;color:${theme.text};text-align:center;text-transform:uppercase;margin-bottom:60px;">${h}</div>
      ${statGrid(theme)}
    </div>`;
  }
  
  if (mode === 'benefits') {
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 60px;">
      <div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:1.0;letter-spacing:-1px;color:${theme.text};text-align:center;text-transform:uppercase;margin-bottom:60px;">${h}</div>
      <div style="width:100%;display:flex;flex-direction:column;gap:20px;">${benefitRows(theme)}</div>
    </div>`;
  }
  
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 60px;text-align:center;">
    <div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:1.0;letter-spacing:-1px;color:${theme.text};text-transform:uppercase;margin-bottom:40px;">${h}</div>
    <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:28px;line-height:1.5;color:${theme.text};opacity:0.7;max-width:700px;">${meta.subtext}</div>
  </div>`;
}

function swissTypoPoster(theme, meta, mode) {
  const h = meta.headline;
  const size = headlineSize(h);
  const words = h.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > 12 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  const typoLines = lines.map((line, i) => 
    `<div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:0.92;letter-spacing:-1px;color:${theme.text};text-transform:uppercase;${i % 2 === 1 ? 'margin-left:80px;' : ''}">${line}</div>`
  ).join('');
  
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 80px;">
    <div style="margin-bottom:30px;">${typoLines}</div>
    <div style="width:100px;height:3px;background:${theme.pop};margin:30px 0;"></div>
    <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:26px;line-height:1.5;color:${theme.text};opacity:0.6;max-width:500px;">${meta.subtext}</div>
  </div>`;
}

function swissModular(theme, meta, mode) {
  const h = meta.headline;
  
  return `<div style="width:100%;height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:20px;padding:40px 60px;">
    <div style="display:flex;flex-direction:column;justify-content:center;padding-right:30px;border-right:2px solid ${theme.light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'};">
      <div style="font-family:'Inter',sans-serif;font-weight:500;font-size:18px;letter-spacing:3px;text-transform:uppercase;color:${theme.accent};margin-bottom:20px;">VIRTUAL INTERNSHIP · 2026</div>
      <div style="${displayFont(theme)}font-weight:700;font-size:${subheadlineSize(h)};line-height:1.0;letter-spacing:-1px;color:${theme.text};">${h}</div>
    </div>
    <div style="display:flex;flex-direction:column;justify-content:center;padding-left:30px;">
      <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:26px;line-height:1.5;color:${theme.text};opacity:0.7;">${meta.subtext}</div>
    </div>
    <div style="grid-column:span 2;display:flex;flex-direction:column;gap:20px;padding-top:20px;border-top:2px solid ${theme.light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'};">
      ${mode === 'stats' ? statGrid(theme) : benefitRows(theme)}
    </div>
  </div>`;
}

function swissStats(theme, meta, mode) {
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 60px;">
    <div style="${displayFont(theme)}font-weight:700;font-size:${subheadlineSize(meta.headline)};line-height:1.0;letter-spacing:-1px;color:${theme.text};text-align:center;text-transform:uppercase;margin-bottom:60px;">${meta.headline}</div>
    ${statGrid(theme)}
  </div>`;
}

function swissQuote(theme, meta, mode) {
  const h = meta.headline;
  const size = headlineSize(h);
  
  return `<div style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:0 80px;text-align:center;">
    <div style="font-family:'Inter',sans-serif;font-weight:300;font-size:48px;line-height:1.4;letter-spacing:0.5px;color:${theme.text};opacity:0.8;margin-bottom:30px;">${meta.subtext}</div>
    <div style="width:200px;height:1px;background:${theme.pop};margin-bottom:30px;"></div>
    <div style="${displayFont(theme)}font-weight:700;font-size:${size};line-height:1.0;letter-spacing:-1px;color:${theme.text};text-transform:uppercase;">${h}</div>
  </div>`;
}

export function buildCardHtml(meta, theme, archetype, mode, format = 'portrait') {
  let inner;
  if (archetype === 'swiss-banner') inner = swissBanner(theme, meta, mode);
  else if (archetype === 'swiss-grid') inner = swissGrid(theme, meta, mode);
  else if (archetype === 'swiss-typo-poster') inner = swissTypoPoster(theme, meta, mode);
  else if (archetype === 'swiss-modular') inner = swissModular(theme, meta, mode);
  else if (archetype === 'swiss-stats') inner = swissStats(theme, meta, mode);
  else if (archetype === 'swiss-quote') inner = swissQuote(theme, meta, mode);
  else if (archetype === 'split-screen') inner = splitScreen(theme, meta, mode);
  else if (archetype === 'framed-center') inner = framedCenter(theme, meta, mode);
  else if (archetype === 'stacked-cards') inner = stackedCards(theme, meta, mode);
  else if (archetype === 'collage') inner = collage(theme, meta, mode);
  else if (archetype === 'bento') inner = bento(theme, meta, mode);
  else inner = diagonalSlab(theme, meta, mode);
  // Song badge on every card — the post carries trending music, so show it.
  return shell(theme, inner, meta.song || null, format);
}

async function renderHtml(html, format = 'portrait') {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: format === 'reel' ? 1920 : 1350 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  const buf = await page.screenshot({ type: 'png' });
  await browser.close();
  return buf;
}

export async function generateDesignerCards({ post, caption, imageMeta, count = 3, previousTheme = null, format = 'portrait' }) {
  const postType = detectPostType(post, caption);
  const theme = pickThemeForPost(postType, previousTheme);
  const archetypes = POST_TYPE_ARCHETYPES[postType] || POST_TYPE_ARCHETYPES.default;
  const modes = ['cover', 'benefits', 'stats'];
  const meta = {
    headline: imageMeta.headline || 'Build Real Skills.',
    subtext: imageMeta.subtext || 'Real industry projects. Mentorship. A portfolio that proves you can build.',
    song: imageMeta.song || null,
    post_type: postType,
  };
  const cards = [];
  for (let i = 0; i < count; i++) {
    const archetype = archetypes[i % archetypes.length];
    const mode = modes[i % modes.length];
    const html = buildCardHtml(meta, theme, archetype, mode, format);
    try {
      const buf = await renderHtml(html, format);
      console.log(`[DESIGNER] Card #${i} (${theme.name} · ${archetype} · ${mode}): ${buf.length} bytes`);
      cards.push(buf);
    } catch (err) {
      console.log(`[DESIGNER] Card #${i} render failed (${err.message}) — skipping`);
    }
  }
  return { cards, themeName: theme.name, postType };
}
const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x22b-instruct-v0.1',
];

export async function generatePost(siteData, previousPosts = [], apiKey, model) {
  const { prompt } = buildContext(siteData, previousPosts);
  const modelsToTry = [...new Set([model, ...FALLBACK_MODELS])];

  let lastErr;
  for (const m of modelsToTry) {
    try {
      const raw = await callNvidia(prompt, apiKey, m);
      if (!raw) throw new Error('Empty response');

      const data = tryParseJson(raw);
      if (data) {
        const post = (data.post || '').trim();
        const html = (data.html || '').trim();
        const imageMeta = { headline: 'DEV/CRAFT', subtext: '100% Free Virtual Internship', cta: 'devcraft.fennark.xyz', style: 'modern-minimal', ...data.imageMeta };
        if (!html) {
          console.log('[GENERATE] No HTML card, using fallback');
          return { post, html: null, imageMeta, theme: siteData.theme };
        }
        console.log(`[GENERATE] ✓ ${post.length} chars + ${html.length} chars HTML (${m})`);
        return { post, html, imageMeta, theme: siteData.theme };
      }

      const post = extractBlock(raw, 'POST') || extractBetween(raw, '---POST---', '---') || raw.replace(/<[^>]+>/g, '').trim();
      const html = extractBlock(raw, 'HTML') || extractBetween(raw, '---HTML---', '---') || null;
      const imageMetaStr = extractBlock(raw, 'IMAGE') || extractBetween(raw, '---IMAGE---', '---');
      let imageMeta = { headline: 'DEV/CRAFT', subtext: '100% Free Virtual Internship', cta: 'devcraft.fennark.xyz', style: 'modern-minimal' };
      if (imageMetaStr) { try { imageMeta = { ...imageMeta, ...JSON.parse(imageMetaStr) }; } catch {} }

      if (!html) {
        console.log('[GENERATE] No HTML card, using fallback');
        return { post, html: null, imageMeta, theme: siteData.theme };
      }
      console.log(`[GENERATE] ✓ ${post.length} chars + ${html.length} chars HTML (${m})`);
      return { post, html, imageMeta, theme: siteData.theme };
    } catch (err) {
      lastErr = err;
      console.log(`[GENERATE] ✗ ${m} — ${err.message.slice(0, 80)}`);
      await sleep(4000);
    }
  }
  throw new Error(`All failed: ${lastErr?.message}`);
}

function buildContext(siteData, previousPosts) {
  const home = siteData.pages?.['/'] || {};
  const about = siteData.pages?.['/about'] || {};

  const siteContext = [
    `Title: ${home.title || 'DEV/CRAFT'}`,
    `Desc: ${home.metaDescription || ''}`,
    `About: ${(about.textContent || '').slice(0, 1000)}`,
    `Home: ${(home.textContent || '').slice(0, 1500)}`,
    `Colors: ${(siteData.theme?.allColors || []).join(', ')}`,
    `CTAs: ${(home.buttons || []).map(b => b.text).filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');

  const dupGuard = previousPosts?.length
    ? `\nSTRICT: NEVER repeat these angles:\n${previousPosts.slice(-5).map(p => `- AVOID: "${p.slice(0, 120)}"`).join('\n')}`
    : '';

  const prompt = `You are DEV/CRAFT's creative director — part marketer, part designer, part psychologist.

SITE DATA:
${siteContext}${dupGuard}

TASK: Create a LinkedIn post + matching image card HTML for DEV/CRAFT (devcraft.fennark.xyz), a 100% free virtual internship for college students.

LINKEDIN COMPANY PAGE: https://www.linkedin.com/company/devcraft-internships/

=== DESIGN STYLES (pick ONE) ===
- brutalist | modern-minimal | glassmorphism | gradient-bold | dark-tech | pixel-art | corporate-clean

=== PSYCHOLOGY RULES ===
- Purple #6366f1 for ambition, dark bg for premium feel
- F-pattern: headline top-left, CTA bottom-right
- Von Restorff: make CTA button visually distinct
- Social proof, scarcity, commitment ladder, peak-end rule

=== RESPOND ONLY WITH THIS JSON (no other text) ===
{
  "post": "LinkedIn post text (200-280 words). Hook first line. devcraft.fennark.xyz link. 3-5 hashtags. No emojis.",
  "html": "<!DOCTYPE html><html><head><style>/* 1200x630 card, brand purple #6366f1, dark bg, chosen style */</style></head><body>...</body></html>",
  "imageMeta": {
    "headline": "max 60 chars",
    "subtext": "max 80 chars",
    "cta": "devcraft.fennark.xyz",
    "style": "chosen-style-name"
  }
}`;

  return { prompt };
}

function tryParseJson(raw) {
  const cleaned = raw.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;
  try { return JSON.parse(cleaned.slice(firstBrace)); } catch {}
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace > firstBrace) {
    try { return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

function extractBlock(text, tag) {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractBetween(text, start, end) {
  const s = text.indexOf(start);
  if (s === -1) return null;
  const e = text.indexOf(end, s + start.length);
  return e === -1 ? text.slice(s + start.length).trim() : text.slice(s + start.length, e).trim();
}

async function callNvidia(prompt, apiKey, model) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2000 }),
    });
    if (res.status === 503) {
      await sleep((attempt + 1) * 5000);
      continue;
    }
    if (!res.ok) { const e = await res.text(); throw new Error(`${res.status}: ${e.slice(0, 200)}`); }
    const j = await res.json();
    return j.choices?.[0]?.message?.content?.trim();
  }
  throw new Error('Max retries');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

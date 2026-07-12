const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x22b-instruct-v1.0',
];

export async function generatePost(siteData, previousPosts = [], apiKey, model) {
  const { siteCtx, dupGuard } = buildContext(siteData, previousPosts);

  // Call 1: post text only
  const postPrompt = `You are DEV/CRAFT's marketing director (SaaS: free virtual internship platform for college students at devcraft.fennark.xyz).

SITE DATA:
${siteCtx}${dupGuard}

Write a LinkedIn post (max 2600 characters). Rules:
- Hook in first line (curiosity/gain/pain)
- Mention devcraft.fennark.xyz link prominently
- Mention @devcraft-internships once naturally in the body
- 3-5 hashtags at end (#DEVCRAFT #VirtualInternship #FreeLearning etc)
- No emojis
- Persuasive, specific, student-focused
- Vary angle from previous posts

Respond with ONLY the post text, nothing else.`;

  const post = await callWithRetry(postPrompt, apiKey, model, 1500);
  if (!post) throw new Error('Post generation failed');

  // Call 2: HTML card only
  const htmlPrompt = `Create a 1200x630 LinkedIn image card as a complete HTML document (with <!DOCTYPE html> and <style>) for this post:

"${post.slice(0, 300)}..."

SAAS: DEV/CRAFT free virtual internship platform, devcraft.fennark.xyz

DESIGN STYLES (pick ONE): brutalist | modern-minimal | glassmorphism | gradient-bold | dark-tech | pixel-art | corporate-clean

RULES:
- NO pure gradient backgrounds. Use solid colors, grids, patterns, panels
- Brand purple #6366f1 as accent (not whole bg)
- Card shows: short headline, supporting subtext, CTA "devcraft.fennark.xyz"
- Make it look like a real marketing asset
- Body must be exactly width:1200px;height:630px;overflow:hidden
- Use system fonts or Google Fonts via @import

Respond with ONLY the HTML, nothing else.`;

  let html = null;
  try { html = await callWithRetry(htmlPrompt, apiKey, model, 2500); } catch {}
  if (html && !html.includes('<html')) html = null;

  const styles = ['brutalist', 'modern-minimal', 'glassmorphism', 'gradient-bold', 'dark-tech', 'pixel-art', 'corporate-clean'];
  const imageMeta = { headline: (post.split('\n')[0] || 'DEV/CRAFT').slice(0, 60), subtext: '100% Free Virtual Internship', cta: 'devcraft.fennark.xyz', style: styles[Math.floor(Math.random() * styles.length)] };

  console.log(`[GENERATE] ✓ ${post.length} chars${html ? ` + ${html.length} HTML` : ' (template card)'}`);
  return { post: post.trim(), html, imageMeta, theme: siteData.theme };
}

function buildContext(siteData, previousPosts) {
  const home = siteData.pages?.['/'] || {};
  const about = siteData.pages?.['/about'] || {};
  const siteCtx = [
    `Title: ${home.title || 'DEV/CRAFT'}`,
    `Desc: ${home.metaDescription || ''}`,
    `About: ${(about.textContent || '').slice(0, 800)}`,
    `Home: ${(home.textContent || '').slice(0, 1000)}`,
    `Colors: ${(siteData.theme?.allColors || []).join(', ')}`,
    `CTAs: ${(home.buttons || []).map(b => b.text).filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');

  const dupGuard = previousPosts?.length
    ? `\nPREVIOUS ANGLES TO AVOID:\n${previousPosts.slice(-5).map(p => `- ${p.slice(0, 100)}`).join('\n')}`
    : '';
  return { siteCtx, dupGuard };
}

async function callWithRetry(prompt, apiKey, model, maxTokens) {
  const modelsToTry = [...new Set([model, ...FALLBACK_MODELS])];
  let lastErr;
  for (const m of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(NVIDIA_CHAT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: maxTokens }),
        });
        if (res.status === 503) { await sleep((attempt + 1) * 4000); continue; }
        if (!res.ok) { const e = await res.text(); throw new Error(`${res.status}: ${e.slice(0, 150)}`); }
        const j = await res.json();
        const text = j.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('Empty');
        return text;
      } catch (err) {
        lastErr = err;
        if (res && res.status === 503) continue;
        await sleep(2000);
      }
    }
  }
  throw new Error(`All models failed: ${lastErr?.message}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

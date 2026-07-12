const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x22b-instruct-v1.0',
];

export async function generatePost(siteData, previousPosts = [], apiKey, model) {
  const { siteCtx, dupGuard } = buildContext(siteData, previousPosts);

  const postPrompt = `You are a viral LinkedIn content creator for DEV/CRAFT (devcraft.fennark.xyz) — a virtual internship platform where Indian engineering students build real industry skills.

SITE DATA:
${siteCtx}${dupGuard}

Write a LinkedIn post that makes people stop scrolling and click. Rules:
- Create urgency, curiosity, or a "I need this" reaction
- SHORT and punchy — aim for 150-400 characters (not a wall of text)
- Drive action: make them want to visit devcraft.fennark.xyz and sign up
- Mention @devcraft-internships and the link naturally
- Use emojis where they add impact
- Include 3-5 relevant hashtags
- Vary tone: sometimes direct, sometimes story-driven, sometimes provocative, sometimes aspirational
- Talk about real outcomes: skills, projects, portfolio, confidence, job readiness
- No generic corporate fluff — sound like a real person

Respond with ONLY the post text, nothing else.`;

  const post = await callWithRetry(postPrompt, apiKey, model, 1500);
  if (!post) throw new Error('Post generation failed');

  // Call 2: HTML card only
  const htmlPrompt = `Create a 1200x630 LinkedIn image card as a complete HTML document (with <!DOCTYPE html> and <style>) for this post:

"${post.slice(0, 300)}..."

SAAS: DEV/CRAFT virtual internship platform, devcraft.fennark.xyz

DESIGN STYLES (pick ONE): brutalist | modern-minimal | glassmorphism | split-panel | terminal | magazine | dark-tech | pixel-art | corporate-clean | bento | outline | lateral-band

RULES:
- NO gradient backgrounds. Use solid colors, grids, patterns, panels, borders
- Brand purple #6366f1 as accent (not whole bg)
- Card shows: short headline, supporting subtext, CTA "devcraft.fennark.xyz"
- Bold, scroll-stopping visual hierarchy
- Body must be exactly width:1200px;height:630px;overflow:hidden
- Use system fonts or Google Fonts via @import

Respond with ONLY the HTML, nothing else.`;

  let html = null;
  try { html = await callWithRetry(htmlPrompt, apiKey, model, 2500); } catch {}
  if (html && !html.includes('<html')) html = null;

  const styles = ['brutalist', 'modern-minimal', 'glassmorphism', 'split-panel', 'terminal', 'magazine', 'dark-tech', 'pixel-art', 'corporate-clean', 'bento', 'outline', 'lateral-band'];
  const imageMeta = { headline: (post.split('\n')[0] || 'DEV/CRAFT').slice(0, 60), subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'devcraft.fennark.xyz', style: styles[Math.floor(Math.random() * styles.length)] };

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
          body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }], temperature: 1.0, max_tokens: maxTokens }),
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

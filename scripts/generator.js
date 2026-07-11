const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x22b-instruct-v0.1',
];

export async function generatePost(siteData, previousPosts = [], apiKey, model) {
  const { prompt, defaultImageMeta } = buildContext(siteData, previousPosts);
  const modelsToTry = [...new Set([model, ...FALLBACK_MODELS])];

  let lastErr;
  for (const m of modelsToTry) {
    try {
      const raw = await callNvidia(prompt, apiKey, m);
      if (!raw) throw new Error('Empty');

      const parts = raw.split('---IMAGE---');
      const post = parts[0]?.trim() || raw;
      let imageMeta = defaultImageMeta;
      if (parts[1]) {
        try { imageMeta = { ...imageMeta, ...JSON.parse(parts[1]) }; } catch {}
      }

      console.log(`[GENERATE] ✓ ${post.length} chars (${m})`);
      return { post, imageMeta, theme: siteData.theme };
    } catch (err) {
      lastErr = err;
      console.log(`[GENERATE] ✗ ${m} — ${err.message.slice(0, 80)}`);
      await sleep(4000);
    }
  }
  throw new Error(`All models failed: ${lastErr?.message}`);
}

function buildContext(siteData, previousPosts) {
  const home = siteData.pages?.['/'] || {};
  const about = siteData.pages?.['/about'] || {};
  const theme = siteData.theme || {};

  const siteContext = [
    `Title: ${home.title || 'DEV/CRAFT'}`,
    `Tagline: ${home.metaDescription || ''}`,
    `About: ${(about.textContent || '').slice(0, 1200)}`,
    `Homepage: ${(home.textContent || '').slice(0, 2000)}`,
    `Brand colors: ${(theme.allColors || []).join(', ')}`,
    `Primary: ${theme.primary || '#6366f1'}`,
    `Sections: ${(home.sections || []).map(s => s.text?.slice(0, 60)).filter(Boolean).join(' | ')}`,
    `CTAs found: ${(home.buttons || []).map(b => `${b.text}${b.href ? ' → ' + b.href.slice(0, 50) : ''}`).filter(Boolean).join(' | ')}`,
    `Links: ${(home.links || []).filter(l => l.text).slice(0, 15).map(l => `${l.text} (${l.href})`).join(', ')}`,
  ].filter(Boolean).join('\n');

  const dupGuard = previousPosts?.length
    ? `\nSTRICT RULE — NEVER repeat these previously posted angles:\n${previousPosts.slice(-5).map(p => `- AVOID: "${p.slice(0, 120)}"`).join('\n')}\nEach post must be about a UNIQUE angle — different topic, different hook, different value proposition.`
    : '';

  const prompt = `You are the LinkedIn content strategist for DEV/CRAFT (devcraft.fennark.xyz), a 100% free virtual internship platform for college students.

LIVE SITE DATA (scraped moments ago):
${siteContext}${dupGuard}

TASK: Write ONE unique LinkedIn post (200-280 words) promoting DEV/CRAFT.

REQUIREMENTS:
- Opening hook that grabs college student attention
- Mention it's 100% FREE and self-paced
- Highlight real projects, instant offer letters, verified certificates
- Include the link: devcraft.fennark.xyz (tell them to visit/apply)
- Add a clear call-to-action with the link
- Add 3-5 relevant hashtags
- Professional, inspiring, student-focused
- No emojis

UNIQUENESS CHECK — Pick ONE angle from below (different from previous posts):
A) Career transformation / student success
B) Skill-building / real projects vs theory
C) Cost/accessibility (100% free)
D) Certificate & offer letter value
E) Self-paced flexibility for busy students
F) Industry-relevant skills
G) Comparison with paid internships

After the post, add "---IMAGE---" then JSON:
{"headline":"max 60 chars","subtext":"max 80 chars","cta":"Apply at devcraft.fennark.xyz"}`;

  return {
    prompt,
    defaultImageMeta: { headline: '100% Free Virtual Internship', subtext: 'Build real projects. Get certified. Kickstart your career.', cta: 'Apply at devcraft.fennark.xyz' },
  };
}

async function callNvidia(prompt, apiKey, model) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 600 }),
    });
    if (res.status === 503) {
      const delay = (attempt + 1) * 5000;
      console.log(`[GENERATE] Rate limited, retry in ${delay / 1000}s`);
      await sleep(delay);
      continue;
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status}: ${err.slice(0, 200)}`);
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content?.trim();
  }
  throw new Error('Max retries (503)');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

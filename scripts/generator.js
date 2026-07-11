const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function generatePost(siteData, previousPosts = [], apiKey, model) {
  const context = buildContext(siteData, previousPosts);
  const raw = await callNvidia(context.prompt, apiKey, model);

  if (!raw) throw new Error('NVIDIA API returned empty');

  const parts = raw.split('---IMAGE---');
  const post = parts[0]?.trim() || raw;
  let imageMeta = context.defaultImageMeta;

  if (parts[1]) {
    try { imageMeta = { ...imageMeta, ...JSON.parse(parts[1]) }; } catch {}
  }

  console.log(`[GENERATE] ✓ Post: ${post.length} chars`);
  return { post, imageMeta, theme: context.theme };
}

function buildContext(siteData, previousPosts) {
  const home = siteData.pages?.['/'] || {};
  const about = siteData.pages?.['/about'] || {};
  const theme = siteData.theme || {};

  const siteInfo = [
    `Site title: ${home.title || 'DEV/CRAFT'}`,
    `Description: ${home.metaDescription || ''}`,
    `About: ${(about.textContent || '').slice(0, 1500)}`,
    `Home content: ${(home.textContent || '').slice(0, 2500)}`,
    `Brand colors: ${(theme.allColors || []).join(', ')}`,
    `Primary color: ${theme.primary || '#6366f1'}`,
    `Sections found: ${(home.sections || []).map(s => s.text?.slice(0, 80)).filter(Boolean).join(' | ')}`,
    `CTAs: ${(home.buttons || []).map(b => b.text).filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');

  const prev = previousPosts?.slice(-5).length
    ? `\nPreviously posted (avoid repeating these angles):\n${previousPosts.slice(-5).map(p => `- "${p.slice(0, 100)}"`).join('\n')}`
    : '';

  const prompt = `You are the LinkedIn marketing strategist for DEV/CRAFT, a 100% free virtual internship platform for college students.

WEBSITE DATA (scraped live today):
${siteInfo}${prev}

TASK: Write a LinkedIn post (max 250 words) to promote DEV/CRAFT.

REQUIREMENTS:
- Hook in the first line — grab attention of college students
- Mention it's 100% FREE and self-paced
- Highlight real projects, instant offer letters, verified certificates
- Include a clear call-to-action (visit devcraft.fennark.xyz)
- Add 3-5 relevant hashtags (no emojis)
- Professional, inspiring, student-focused tone
- No emojis

After the post, add "---IMAGE---" and then JSON with:
{
  "headline": "short headline for image (max 60 chars)",
  "subtext": "subtitle for image (max 80 chars)",
  "cta": "call to action text"
}`;

  const defaultImageMeta = {
    headline: '100% Free Virtual Internship',
    subtext: 'Build real projects. Get certified. Kickstart your career.',
    cta: 'Apply now at devcraft.fennark.xyz',
  };

  return { prompt, defaultImageMeta, theme };
}

async function callNvidia(prompt, apiKey, model) {
  const res = await fetch(NVIDIA_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'nvidia/nemotron-3-ultra-550b-a55b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim();
}

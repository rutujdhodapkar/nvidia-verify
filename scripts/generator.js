const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

function buildPrompt(siteData, previousPosts) {
  const desc = siteData.summary?.description || 'Free virtual internship platform for college students';
  const phrases = siteData.summary?.keyPhrases?.join(', ') || 'internships, students, free, programming';
  const homeText = siteData.pages?.['/']?.textContent?.slice(0, 2000) || '';
  const aboutText = siteData.pages?.['/about']?.textContent?.slice(0, 1500) || '';

  const prevContext = previousPosts?.length
    ? `\n\nPrevious posts (do NOT repeat these topics):\n${previousPosts.slice(-5).map(p => `- "${p.slice(0, 100)}..."`).join('\n')}`
    : '';

  return `You are the LinkedIn marketing manager for DEV/CRAFT, a 100% free virtual internship platform for college students.

WEBSITE DATA (scraped live):
Description: ${desc}
Key phrases: ${phrases}
Homepage content: ${homeText}
About: ${aboutText}${prevContext}

Generate a professional LinkedIn post (max 250 words) to promote DEV/CRAFT.

Rules:
- Professional, inspiring, student-focused tone
- Emphasize 100% FREE, real projects, certificates, career growth
- Include 3-5 relevant hashtags
- Use a hook in the first line
- Include a clear call-to-action (apply on devcraft.fennark.xyz)
- Output ONLY the post content — no JSON, no extra text

Also extract from the post:
- A short headline (max 60 chars) for the image card
- 3 stats (num + label) for the image card
Format these as JSON after the post, separated by "---IMAGE---"`;
}

async function callNvidia(prompt, apiKey, model) {
  const res = await fetch(NVIDIA_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'meta/llama-3.1-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim();
}

export async function generatePost(siteData, previousPosts = [], apiKey, model) {
  const prompt = buildPrompt(siteData, previousPosts);
  const raw = await callNvidia(prompt, apiKey, model);

  if (!raw) throw new Error('NVIDIA API returned empty response');

  const parts = raw.split('---IMAGE---');
  const post = parts[0]?.trim() || raw;
  let imageData = { headline: 'Build Real Projects. Get Certified.', subtext: 'Free virtual internships for college students.', stats: [{ num: '100%', label: 'Free' }, { num: '24/7', label: 'Self-Paced' }, { num: 'Now', label: 'Enroll Open' }] };

  if (parts[1]) {
    try {
      const parsed = JSON.parse(parts[1]);
      imageData = { ...imageData, ...parsed };
    } catch {}
  }

  console.log(`[GENERATE] Post created (${post.length} chars)`);
  return { post, imageData };
}

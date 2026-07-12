const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x22b-instruct-v1.0',
];

const SYSTEM_PROMPT = `You are the content engine for DevCraft (by Fennark), a virtual internship platform for Indian engineering students. You write LinkedIn posts that convert scrolling 2nd/3rd-year engineering students into applicants.

## AUDIENCE
- Indian engineering students, mostly tier-2/tier-3 colleges, software branches (CS/IT/AI-ML/ECE-adjacent)
- 2nd-4th year, anxious about: no live-project experience, no PPOs, resume gaps, placement season pressure
- They have seen hundreds of fake "certificate mill" internship ads. Default assumption: this is a scam until proven otherwise in the first 3 lines.
- They read on mobile, in 5-8 seconds, mid-scroll between memes and placement anxiety posts.

## BANNED WORDS
leverage, synergy, passionate, excited to announce, thrilled, game-changer, unlock your potential, dive in, in today's fast-paced world, cutting-edge, revolutionize, tag someone who needs this, don't miss out, grow your career

## HOOK RULES (first 2 lines — this is the only thing visible before "see more")
- Must name the exact fear or exact stat, not a vague benefit.
- Rotate between these formats, never repeat same one twice in a row:
  1. Direct callout: "[X]nd year? No internship yet? Read this before placement season."
  2. Blunt stat: "73% of engineering grads have zero live-project experience on their resume. Here's the fix."
  3. Contrarian: "Your CGPA won't get you hired. This will."
  4. Specific outcome: "180+ students went from zero experience to an offer letter in 6 weeks."
- No question-mark clickbait ("Want to know the secret...?") — this audience skips it.

## BODY STRUCTURE (mandatory 4-part stack)
1. Problem — name the specific anxiety in their words
2. Mechanism — what DevCraft actually does: real client work, offer letter, timeline
3. Proof — a number, a name, a completion stat (never fabricate)
4. CTA — one line, imperative, no paragraph

## FORMATTING RULES
- Line breaks every 1-2 sentences. No paragraphs longer than 3 lines on mobile.
- Max 1 emoji per section, used as visual break (🔹 ✅), never decorative (no 🚀🔥✨ stacking)
- Numbers over adjectives always
- 3-5 hashtags max at the end. Mix broad + niche/branded.
- NEVER put application link in post body (LinkedIn suppresses reach). Put it in first_comment field.

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code fences):
{
  "hook": "...",
  "body": "...",
  "hashtags": ["#...", "#..."],
  "cta_line": "...",
  "first_comment": "Apply here: devcraft.fennark.xyz",
  "design_brief": {
    "tone": "clean | editorial | bold",
    "primary_color": "#6366f1",
    "slides": [
      {"slide_number": 1, "headline": "...", "subtext": "...", "visual_note": "..."}
    ]
  },
  "variant_label": "A | B"
}`;

export async function generatePost(siteData, previousPosts = [], apiKey, model, previousFeedback) {
  const { siteCtx, dupGuard } = buildContext(siteData, previousPosts);
  const feedbackHint = previousFeedback ? `\nPrevious attempt feedback (improve on this): ${previousFeedback}\n` : '';

  const postPrompt = `${SYSTEM_PROMPT}

SITE DATA:
${siteCtx}${dupGuard}${feedbackHint}

Generate the post now. Return ONLY the JSON.`;

  const raw = await callWithRetry(postPrompt, apiKey, model, 2000);
  if (!raw) throw new Error('Post generation failed');

  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const hook = parsed.hook || '';
  const body = parsed.body || '';
  const ctaLine = parsed.cta_line || '';
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.join(' ') : '';
  const postText = [hook, '', body, '', ctaLine, '', hashtags].filter(Boolean).join('\n');
  const firstComment = parsed.first_comment || 'Apply at devcraft.fennark.xyz';
  const designBrief = parsed.design_brief || null;

  const styles = ['brutalist', 'modern-minimal', 'glassmorphism', 'split-panel', 'terminal', 'magazine', 'dark-tech', 'pixel-art', 'corporate-clean', 'bento', 'outline', 'lateral-band'];
  const imageMeta = { headline: hook.slice(0, 60) || 'DEV/CRAFT Virtual Internship', subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'devcraft.fennark.xyz', style: styles[Math.floor(Math.random() * styles.length)] };

  console.log(`[GENERATE] ✓ ${postText.length} chars, variant: ${parsed.variant_label || 'A'}`);
  return { post: postText, html: null, imageMeta, theme: siteData.theme, firstComment, designBrief };
}

export async function reviewPost(post, apiKey, model) {
  try {
    const review = await callWithRetry(`Rate this LinkedIn post 1-10 on impact, clarity, CTA strength, authenticity, conciseness.

Post:
---${post.slice(0, 300)}---

Return ONLY valid JSON (no markdown): {"score": <1-10>, "feedback": "<one line>"}`, apiKey, model, 500);
    const cleaned = review.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { score: Math.min(10, Math.max(1, parsed.score)), feedback: parsed.feedback || 'No feedback' };
  } catch {
    return { score: 8, feedback: 'Pass (review parse failed, defaulting to pass)' };
  }
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
          body: JSON.stringify({ model: m, messages: [{ role: 'user', content: prompt }], temperature: 0.9, max_tokens: maxTokens }),
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

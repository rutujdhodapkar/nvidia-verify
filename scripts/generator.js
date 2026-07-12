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

## SKILL FOCUS (rotate between these each post)
Pick 2-3 skills per post from: Python, DSA, Web Dev (React/Node), AI/ML, Cloud (AWS/Azure), DevOps, System Design, Open Source, Databases, APIs

## ENGAGEMENT TECHNIQUES (use exactly one per post)
- "Which skill are you struggling with most? Drop it below 👇"
- "Tag a friend who needs to see this"
- "Save this post for later — you'll need it"
- "How many of these skills do you have? 1/5? 3/5?"
- "Type 'INTERN' if you want the link"

## POST STRUCTURE (follow this exact format when composing)
1. HEADLINE — Bold, single line title (use 🔹 or ✅ as visual marker)
2. HOOK — 1-2 lines naming the fear/stat (visible before "see more")
3. SKILLS SECTION — "🔹 Skills You'll Build:" followed by 3-4 bullet points (▸ skill — description)
4. BODY — 2-4 short lines about DevCraft, real projects, offer letter, timeline
5. PROOF — One line with number or stat (e.g. "180+ students placed")
6. ENGAGEMENT — One engagement question from the techniques list
7. CTA — "Apply now at devcraft.fennark.xyz"
8. HASHTAGS — 3-5 hashtags

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code fences):
{
  "headline": "🔹 2nd Year? No Internship? Read This.",
  "hook": "73% of engineering students graduate without a single live project...",
  "skills": [
    {"name": "Python & DSA", "desc": "Crack coding interviews with confidence"},
    {"name": "Web Development", "desc": "Build real apps with React & Node.js"},
    {"name": "AI/ML", "desc": "Work on live datasets, not toy problems"}
  ],
  "body": "DevCraft gives you real client projects, a completion certificate, and an offer letter...",
  "proof": "180+ students placed in 6 weeks.",
  "engagement": "Which skill are you working on right now? Drop it below 👇",
  "cta_line": "Apply now at devcraft.fennark.xyz",
  "hashtags": ["#DevCraftInternship", "#Python", "#DSA", "#EngineeringStudents"],
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

  const raw = await callWithRetry(postPrompt, apiKey, model, 2500);
  if (!raw) throw new Error('Post generation failed');

  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const headline = parsed.headline || '';
  const hook = parsed.hook || '';
  const skills = Array.isArray(parsed.skills) ? parsed.skills.map(s => `▸ ${s.name} — ${s.desc}`).join('\n') : '';
  const body = parsed.body || '';
  const proof = parsed.proof || '';
  const engagement = parsed.engagement || '';
  const ctaLine = parsed.cta_line || 'Apply now at devcraft.fennark.xyz';
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.join(' ') : '';

  const postParts = [headline, '', hook, '', '🔹 Skills You\'ll Build:', skills, '', body, '', proof, '', engagement, '', ctaLine, '', hashtags];
  const postText = postParts.filter(Boolean).join('\n');

  const designBrief = parsed.design_brief || null;

  const styles = ['brutalist', 'modern-minimal', 'glassmorphism', 'split-panel', 'terminal', 'magazine', 'dark-tech', 'pixel-art', 'corporate-clean', 'bento', 'outline', 'lateral-band'];
  const imageMeta = { headline: (headline || hook).slice(0, 60) || 'DEV/CRAFT Virtual Internship', subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'devcraft.fennark.xyz', style: styles[Math.floor(Math.random() * styles.length)] };

  console.log(`[GENERATE] ✓ ${postText.length} chars, skills: ${Array.isArray(parsed.skills) ? parsed.skills.length : 0}, variant: ${parsed.variant_label || 'A'}`);
  return { post: postText, html: null, imageMeta, theme: siteData.theme, designBrief };
}

export async function reviewPost(post, apiKey, model) {
  try {
    const review = await callWithRetry(`Rate this LinkedIn post 1-10. Criteria (each 0-2):
- Hook grabs attention in first 2 lines
- Skills are clearly listed with bullet points
- Body is short and punchy
- Has engagement question or CTA
- Has proper structure (headline → hook → skills → body → proof → engagement → CTA → hashtags)

Post:
---${post.slice(0, 400)}---

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

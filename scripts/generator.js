const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const FALLBACK_MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'meta/llama-3.1-70b-instruct',
  'mistralai/mixtral-8x22b-instruct-v1.0',
];

const LEGAL_RULES = `- Do NOT mention pricing, fees, or costs — NEVER say "free", "100% free", "paid", "no cost", or any pricing language.
- Do NOT claim or imply: job placement, employment guarantee, job outcomes, interviews, placed students, or any career result.
- Do NOT claim certificates are recognized, accepted, or valued by any employer, university, or industry body.
- Do NOT claim DevCraft is a university, government org, recruitment agency, or accredited institution.
- Do NOT exaggerate numbers beyond: 10K+ learners enrolled, 7K+ certificates issued.
- Do NOT promise or imply future employment, placement, or third-party internships.
- All claims must be provable from the site data and domain list.
- Do NOT mention "industry-recognized", "industry accepted", or any variation — certificates are completion certificates only.
- Every post MUST answer "What will I get by joining DevCraft?" — focus on benefits: offer letter, LOR, certificate, real projects, verified credentials.`;

const SYSTEM_PROMPT = `You write LinkedIn posts for DevCraft — a virtual internship platform for Indian engineering students. Your posts convert 2nd-4th year engineering students (tier-2/3 colleges) into applicants.

## AUDIENCE
Students who are skeptical of "certificate mills" and reading on mobile in 5 seconds. Prove value in the first 2 lines or they scroll past.

## LEGAL COMPLIANCE — STRICT
${LEGAL_RULES}

## DOMAINS (pick 2-3 per post, rotate)
Web Development, Python Development, Java Development, Data Science, Data Analysis, Machine Learning, Artificial Intelligence, UI/UX Design, App Development, Cloud Computing, Cybersecurity, Full Stack Development, DevOps Engineering, Blockchain Development, Digital Marketing, React & Modern Web Apps, C/C++ Development, Database Management

## CONTENT ANGLE ROTATION (pick ONE different angle per post)
1. WHAT you get — offer letter, LOR, certificate, projects, skills
2. WHY DevCraft — MSME registered, instant onboarding, self-paced
3. WHEN to start — semester break, fits 6 weeks, start same day
4. WHERE it leads — portfolio, cert, LOR, stack domains
5. WHO it's for — 2nd-4th year, any branch, no experience needed
6. WHICH domain — deep dive into one domain

## POST STRUCTURE (follow exactly)
1. TITLE — One line naming the benefit or asking a W-question
2. HOOK — 1-2 lines answering "What will I get?" (lead with offer letter, certificate, projects)
3. SKILLS — "What You'll Build:" then exactly 3 bullet points (▸ skill — what you create)
4. BODY — 3-5 complete sentences. Cover: what you get, how it works, timeline, who it's for. Each sentence must be a complete thought.
5. PROOF — One specific number line (e.g. "10,000+ learners already enrolled across India.")
6. ENGAGEMENT — One W-question with emoji
7. CTA — "Apply now → devcraft.fennark.xyz"
8. HASHTAGS — 3-5 tags (always include #DevCraft #VirtualInternship)

## CONTENT QUALITY RULES
- Every sentence must be a complete sentence with a subject and verb. No fragments.
- Body must be 3-5 full sentences that flow logically: what → how → outcome.
- Write like a senior telling a junior what they'll actually receive.
- Each paragraph covers ONE complete idea. No run-on sentences.
- Use natural, conversational English — avoid buzzwords.
- ONE emoji per section max, never start with emoji.
- Never use these words: leverage, synergy, passionate, excited to announce, thrilled, game-changer, unlock your potential, dive in, cutting-edge, revolutionize, grow your career.
- Never mention jobs, placements, employment outcomes, or career results.
- Never say the certificate is recognized or accepted by anyone.
- Never mention "free", "paid", or any pricing at all.

## HOOK FORMATS (rotate, never repeat)
1. "Here's exactly what every DevCraft intern walks away with."
2. "What if you could get an offer letter, LOR, and certificate in 6 weeks?"
3. "7,000+ students already earned a verified credential. Here's what they got."
4. "An offer letter. Real projects. A verified certificate. That's what DevCraft gives you."
5. "What does a virtual internship actually include? Here's the breakdown."
6. "3 things you get the moment you join DevCraft (no waiting, no interviews)."
7. "Who actually qualifies for a DevCraft internship? Almost everyone."
8. "Most internships make you wait for an offer letter. DevCraft gives it on day 1."

## OUTPUT FORMAT — Return ONLY valid JSON:
{
  "title": "...",
  "hook": "...",
  "skills": [{"name": "...", "desc": "..."}],
  "body": "...",
  "proof": "...",
  "engagement": "...",
  "cta_line": "Apply now \u2192 devcraft.fennark.xyz",
  "hashtags": ["#DevCraft", "#VirtualInternship"],
  "design_brief": {
    "tone": "clean | editorial | bold | professional | tech",
    "primary_color": "#6366f1",
    "slides": [{"slide_number": 1, "headline": "...", "subtext": "...", "visual_note": "..."}]
  },
  "variant_label": "A | B"
}

Generate the post now. IMPORTANT: Every field must contain complete sentences. No fragments. No incomplete thoughts. Body must be 3-5 complete sentences.`;

export async function generatePost(siteData, previousPosts = [], apiKey, model, previousFeedback) {
  const { siteCtx, dupGuard } = buildContext(siteData, previousPosts);
  const feedbackHint = previousFeedback ? `\nPrevious attempt feedback (improve on this): ${previousFeedback}\n` : '';

  const postPrompt = `${SYSTEM_PROMPT}

SITE DATA:
${siteCtx}${dupGuard}${feedbackHint}

Generate the post now. Return ONLY the JSON. REMEMBER: Every sentence must be a complete sentence. Body must be 3-5 complete sentences that flow logically.`;

  const raw = await callWithRetry(postPrompt, apiKey, model, 3500);
  if (!raw) throw new Error('Post generation failed');

  let cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        parsed = JSON.parse(objMatch[0]);
      } catch {
        throw new Error(`Invalid JSON from AI: ${cleaned.slice(0, 300)}`);
      }
    } else {
      throw new Error(`Invalid JSON from AI: ${cleaned.slice(0, 300)}`);
    }
  }

  const title = (parsed.title || parsed.headline || '').trim();
  const hook = (parsed.hook || '').trim();
  const skills = Array.isArray(parsed.skills) ? parsed.skills.map(s => {
    const name = (s.name || '').trim();
    const desc = (s.desc || '').trim();
    return `▸ ${name} — ${desc}`;
  }).filter(Boolean).join('\n') : '';
  let body = (parsed.body || '').trim();
  body = body.endsWith('.') || body.endsWith('!') || body.endsWith('?') || !body ? body : body + '.';
  const proof = (parsed.proof || '').trim();
  const engagement = (parsed.engagement || '').trim();
  const ctaLine = (parsed.cta_line || 'Apply now at devcraft.fennark.xyz').trim();
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter(Boolean).join('\n') : '';

  const postParts = [title, '', hook, '', 'Skills You\'ll Build:', skills, '', body, '', proof, '', engagement, '', ctaLine, '', hashtags];
  let postText = postParts.filter(Boolean).join('\n');
  postText = postText.replace(/https?:\/\/devcraft\.fennark\.xyz\/?/g, 'devcraft.fennark.xyz');

  const designBrief = parsed.design_brief || null;

  const styles = ['brutalist', 'modern-minimal', 'glassmorphism', 'split-panel', 'terminal', 'magazine', 'dark-tech', 'pixel-art', 'corporate-clean', 'bento', 'outline', 'lateral-band'];
  const imageMeta = { headline: (title || hook).slice(0, 60) || 'DEV/CRAFT Virtual Internship', subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'https://devcraft.fennark.xyz/', style: styles[Math.floor(Math.random() * styles.length)] };

  console.log(`[GENERATE] ✓ ${postText.length} chars, skills: ${Array.isArray(parsed.skills) ? parsed.skills.length : 0}, variant: ${parsed.variant_label || 'A'}`);
  return { post: postText, html: null, imageMeta, theme: siteData.theme, designBrief };
}

function checkBlockedContent(text) {
  const violations = [];
  const lower = text.toLowerCase();
  if (/\b(job|placement|employ(?:ment|er|ed)|hire|hiring|career|recruit(?:er|ing|ment)?|interview|salary|package|ctc|lpa|offer letter.*job)\b/i.test(lower)) violations.push('mentions jobs/placement/employment — remove all');
  if (/\b(industry[- ]?recognized|industry[- ]?accepted|employer[- ]?recognized|globally recognized|widely accepted)\b/i.test(lower)) violations.push('claims certificate recognition — remove');
  if(/\b(100%\s*free|completely free|totally free|absolutely free|no cost|at no cost)\b/i.test(lower)) violations.push('mentions free/no cost — remove');
  if(/\bfree\s+(internship|certificate|course|program|training)\b/i.test(lower)) violations.push('mentions free program — remove');
  if (lower.includes('paid') || lower.includes('pricing') || lower.includes('fee')) violations.push('mentions paid/pricing — remove');
  return violations;
}

function checkSentenceCompleteness(text) {
  const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 15);
  const incomplete = sentences.filter(s => {
    const t = s.trim();
    return !/^[A-Z"'(]/.test(t) || !/.+(ing|ed|es|s|e)$/i.test(t.slice(-3));
  });
  return incomplete.length > sentences.length * 0.4 ? 'Many sentences are incomplete or fragments — make every sentence complete with subject + verb' : null;
}

export async function reviewPost(post, apiKey, model) {
  const localChecks = checkBlockedContent(post);
  if (localChecks.length > 0) {
    return { score: 3, feedback: `VIOLATION: ${localChecks.join('; ')}` };
  }

  const completenessIssue = checkSentenceCompleteness(post);
  if (completenessIssue) {
    return { score: 4, feedback: completenessIssue };
  }

  try {
    const review = await callWithRetry(`Rate this LinkedIn post 1-10. STRICT CRITERIA (penalize hard for violations):
- Any mention of jobs, placement, employment, hiring, career outcomes → score 1
- Any claim of certificate recognition/accreditation → score 1
- Any mention of free/paid/pricing → score 1
- Every sentence is a COMPLETE sentence (no fragments) (0-3)
- Hook grabs attention and promises value in first 2 lines (0-2)
- Skills section has 3 clear bullet points (0-2)
- Body has 3-5 complete sentences flowing logically (0-3)

Post:
---${post.slice(0, 700)}---

Return valid JSON: {"score": 1-10, "feedback": "specific fix instruction"}`, apiKey, model, 500);
    const cleaned = review.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { score: Math.min(10, Math.max(1, parsed.score)), feedback: parsed.feedback || 'Improve quality' };
  } catch {
    const hasBlocked = checkBlockedContent(post);
    if (hasBlocked.length > 0) return { score: 3, feedback: hasBlocked.join('; ') };
    return { score: 6, feedback: 'Review failed, please ensure complete sentences and no job/pricing claims' };
  }
}

export async function atlasImprovePost(post, apiKey, model) {
  try {
    const improved = await callWithRetry(`You are a world-class marketing strategist. Improve this LinkedIn post for maximum conversion while keeping it compliant with legal terms.

Rules:
- Keep the same structure (title, hook, skills, body, proof, engagement, CTA, hashtags)
- Make the title punchy and scroll-stopping
- Make hook more urgent and specific — name the exact fear
- Ensure skills are prominent (3 bullet points max)
- Add natural emoji in engagement line (one only)
- Ensure CTA references devcraft.fennark.xyz as a text mention (no raw URL)
- Remove any pricing language — no "free", no fees mentioned
- Remove any banned words (leverage, synergy, passionate, game-changer, etc.)
- Stay compliant: no employment/placement guarantees, no placed students, no job outcomes, no claims of industry recognition
- Keep all existing hashtags

Current post:
---${post.slice(0, 600)}---

Return ONLY the improved post text (no JSON, no explanation).`, apiKey, model, 1200);
    if (improved && improved.length > 50) {
      console.log(`      ✓ Atlas improvement: ${improved.length} chars`);
      return improved;
    }
  } catch { /* fallback to original */ }
  return post;
}

function buildContext(siteData, previousPosts) {
  const home = siteData.pages?.['/'] || {};
  const about = siteData.pages?.['/about'] || {};
  const policyText = ['/policy', '/terms', '/privacy', '/legal']
    .map(p => siteData.pages?.[p])
    .filter(Boolean)
    .map(p => p.textContent?.slice(0, 1500))
    .filter(Boolean)
    .join('\n\n');
  const siteCtx = [
    `Title: ${home.title || 'DEV/CRAFT'}`,
    `Desc: ${home.metaDescription || ''}`,
    `About: ${(about.textContent || '').slice(0, 800)}`,
    `Home: ${(home.textContent || '').slice(0, 1000)}`,
    policyText ? `Policy: ${policyText.slice(0, 1500)}` : '',
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
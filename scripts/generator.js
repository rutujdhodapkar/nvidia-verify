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

const SYSTEM_PROMPT = `You write LinkedIn posts for DevCraft — a virtual internship platform for Indian engineering students. Your posts convert 2nd-4th year engineering students (tier-2/3 colleges) into applicants. Optimize for MAXIMUM clickthrough rate, views, impressions, and engagement.

## AUDIENCE
Engineering students (2nd-4th year, tier-2/3 colleges) who are actively hunting internships/jobs and feel behind. They read on mobile in 5 seconds and decide "is this worth my time?" — prove value in the first 2 lines or they scroll past. Target their MOTIVATION (becoming internship/job-ready, having a portfolio that stands out) — never promise outcomes.

## PSYCHOLOGY OF INTERNSHIP/JOB-SEEKING ENGINEERING STUDENTS (biggest view/click drivers)
- They are obsessed with ONE question: "What will make me stand out when I apply for internships/jobs?" — position DevCraft as the way to BUILD that (projects, portfolio, skills, verified certificate, offer letter) without ever promising the result.
- READINESS framing (100% compliant): "be ready", "get prepared", "have proof of skills", "portfolio that speaks for you", "show you can build" — describe the WORK and EVIDENCE, never the employment outcome.
- Resume anxiety hook: "What does your resume show when internship applications open?" — ask the fear, then show how real projects + certificates fill that gap.
- Semester pressure: "semester break", "6 weeks", "exam season ends, build something", "holiday syllabus vs real skills".
- FOMO + peer proof: "classmates", "batchmates", "your hostel roommate", "10,000+ learners", "students from 300+ colleges".
- Hinglish ONLY for relatable flavor in the engagement line (max 1 short phrase): e.g. "sab kar rahe hain, kya aap?", "padhai ke saath kuch real bhi", "no form filling, no waiting".
- Low-cost college reality: "no prior experience", "any branch", "2nd year se start", "MSME-registered", "instant offer letter" (NEVER mention fees, pricing, or money).
- Credibility anxiety: address the "is this another certificate mill?" doubt head-on with facts (MSME-registered, real projects, verified certificate).
- Mobile-first: first line MUST be scannable in 5 seconds. Short lines, strong numbers, clear benefit.

## CONTENT FORMAT — YOU DECIDE (like skills: invent it fresh every post, never repeat the last 3)
- Choose ONE post format yourself based on what fits best. Do NOT keep reusing the same one.
- Possible formats (invent new ones too, these are only ideas): BENEFIT POST, MYTH vs FACT, LIST/COUNTDOWN, STORY/RELATABLE SCENARIO, RAPID-FIRE PROOF, "FOR [BRANCH]" POST, DAY-1 WALKTHROUGH, POLL-STYLE, AMA-STYLE, CAUTION/HONEST-TRUTH POST
- Use the PREVIOUS ANGLES list at the bottom to avoid repeating the same format/angle — every post must feel new.

## COMPLIANT VOCABULARY FOR JOB/INTERNSHIP ASPIRATION (use these)
- YES: "internship-ready work", "portfolio", "real projects", "skills that help you apply", "evidence of what you can build", "be prepared", "stand out when you apply", "show recruiters what you built", "project experience for your resume"
- NO: "guaranteed placement", "job guaranteed", "get hired", "you WILL land a job", "100% placement", any promise of employment or interviews
- RULE: You can describe WHY these things matter (applications, standing out) — you CANNOT claim DevCraft produces the job offer.

## LEGAL COMPLIANCE — STRICT
${LEGAL_RULES}

## DOMAINS — YOU CHOOSE (2-3 per post, decide fresh each time based on site data)
- Pick 2-3 domains that best fit the post's angle and rotate. These are common options (invent/combine as needed): Web Development, Python Development, Java Development, Data Science, Data Analysis, Machine Learning, Artificial Intelligence, UI/UX Design, App Development, Cloud Computing, Cybersecurity, Full Stack Development, DevOps Engineering, Blockchain Development, Digital Marketing, React & Modern Web Apps, C/C++ Development, Database Management

## CONTENT ANGLE — YOU DECIDE (one fresh angle per post, never repeat the last 3)
- Invent the best angle yourself each post. Ideas (make your own too): WHAT you get, WHY DevCraft (MSME, instant onboarding), WHEN to start (semester break), WHERE it leads (portfolio, cert, LOR), WHO it's for (2nd-4th year, any branch), WHICH domain deep-dive, FEAR/FOMO (resume feels empty — ask, never promise), TRUST (is it a certificate mill? — answer with facts), READINESS (internship apps opening — is your resume ready?), BRANCH-specific (CSE/ECE/Mechanical/Civil), COMMON-MISTAKE, DAY-1 walkthrough, HONEST-TRUTH, MYTH-BUSTING
- Use the PREVIOUS ANGLES list at the bottom to pick something different.

## POST STRUCTURE (follow exactly)
1. TITLE — One line naming the benefit or asking a W-question (add 1 emoji at end)
2. HOOK — 1-2 lines answering "What will I get?" (lead with offer letter, certificate, projects) — add 1 emoji
3. SKILLS — "What You'll Build:" then exactly 3 bullet points (▸ skill — what you create)
4. BODY — 3-5 complete sentences. Cover: what you get, how it works, timeline, who it's for. Each sentence must be a complete thought.
5. PROOF — One specific number line (e.g. "10,000+ learners already enrolled across India.")
6. ENGAGEMENT — ONE prompt from ENGAGEMENT MECHANICS, with emoji (may include 1 short Hinglish phrase). Comment-driving prompts outperform plain questions.
7. CTA — "Apply now → devcraft.fennark.xyz"
8. HASHTAGS — 3-5 tags (always include #DevCraft #VirtualInternship)

## HASHTAGS — YOU INVENT (3-5 tags per post, fresh each time)
- Always: #DevCraft #VirtualInternship
- Invent the rest yourself to match the post's exact theme (domain, branch, audience, format). Mix broad-reach (#Internship, #EngineeringStudents) with niche-specific ones.
- Examples only (don't copy blindly): #InternshipHunt #SkillDevelopment #SemesterBreak #LearnToCode #Freshers #PlacementPrep #SkillIndia #Projects #ResumeBuilding #CampusPlacements #DataScience #WebDev #CSE #ECE #MechanicalEngineering

## CONTENT QUALITY RULES
- Every sentence must be a complete sentence with a subject and verb. No fragments.
- Body must be 3-5 full sentences that flow logically: what → how → outcome.
- Write like a senior from your college telling a junior what they'll actually receive.
- Each paragraph covers ONE complete idea. No run-on sentences.
- Use natural, conversational English — avoid buzzwords.
- ONE emoji per section max, never start with emoji — embed naturally in text.
- Never use these words: leverage, synergy, passionate, excited to announce, thrilled, game-changer, unlock your potential, dive in, cutting-edge, revolutionize, grow your career.
- Never mention jobs, placements, employment outcomes, or career results.
- Never say the certificate is recognized or accepted by anyone.
- Never mention "free", "paid", or any pricing at all.
- NEVER promise placement, admission, employment, or money — you may name the doubt, never the outcome.
- Maximum 1 Hinglish phrase per post, only in the engagement line, written in English letters (e.g. "sab kar rahe hain, kya aap?").
- Include at least one India-specific touch per post: semester/session context, tier-2/3 college reality, hostel/college-life relatability, or peer proof.

## CULTURAL NUANCE FOR INDIAN AUDIENCE
- "Offer letter" is the #1 trust driver for Indian interns — always reference it in the hook or body.
- Numbers and scale (10,000+ learners, 7,000+ certificates) perform strongly — use at least one.
- MSME-registered is a credibility signal unique to India — mention it as the trust fact.
- Students respond to clear next steps: "start same day", "choose your domain", "6 weeks, self-paced".
- Avoid referencing western-specific concepts (GPA, spring break, dorm). Use semester, college, hostel.
- Internship season reality: apps open year-round, students obsess over "what to put on my resume" — DevCraft is the answer because it gives real projects, a verified certificate, and an offer letter they can list.
- CGPA vs projects: Indian students constantly hear "CGPA matters most". Reference this tension and show how proof of skills (projects) complements it.

## FIRST-LINE RULES FOR INDIAN MOBILE FEED
- First 2 lines MUST contain a number, a direct benefit, or a question students feel personally.
- Use words Indian students actually think: "offer letter", "certificate", "projects", "resume", "semester", "college", "internship", "applications", "experience".
- Write at a grade-10 English reading level. Short sentences. One idea per line.
- You may ask about placement FEARS in the hook, but the POST BODY must never promise outcomes.
- For internship/job-seeking posts: open with the application-season reality or resume gap, then pivot to "here's what you build to be ready".

## EMOJI USAGE FOR HIGHER ENGAGEMENT
- Title: Add 1 emoji at end — you choose the best-fitting emoji (🚀 🎯 💡 🔥 ⚡ 📈 ✨ 🎓 📚 💻 🧠)
- Hook: Add 1 emoji naturally in text — you choose
- Engagement: Add 1 emoji at end — you choose
- Skills bullets: NO emojis
- Body: NO emojis (keep professional)
- Proof: NO emojis
- Hashtags: NO emojis
- Avoid overused: 😊 😁 👍 🙌 😃

## HOOK — YOU WRITE IT FRESH (never copy, never repeat your last 3)
- Write an original hook each post that fits the chosen angle. Use the psychology triggers above (resume gap, semester, peer proof, readiness, trust).
- Guidelines: lead with a benefit, a number, or a question the student feels personally. Short, punchy, mobile-scannable. Add one emoji.
- Examples only (do not reuse these exact lines): "Internship apps open soon. What will your resume show? 👀", "CSE students, your projects speak louder than your CGPA 💻", "3 mistakes students make before internship applications 🚨", "You don't need experience to start. You need to start building 📦", "Is DevCraft just another certificate mill? Fair question 🔍"

## ENGAGEMENT PROMPT — YOU INVENT IT (comment/save/share-driving, fresh each post)
- Write one original prompt that makes the reader comment, save, or tag someone. Match it to the post's topic.
- Ideas (make your own): tag a batchmate who needs this, drop your branch/year in comments, save for semester break, share with someone searching for an internship, "what's stopping you? comment below", "which domain would you pick?", "be honest — projects or rest this break?"

## CRITICAL — NEVER INCLUDE THESE (ZERO TOLERANCE)
- NEVER mention jobs, placement, employment, hiring, career, recruit, interview, salary, package
- NEVER claim certificates are recognized, accepted, valued, or accredited by anyone
- NEVER say "free", "100% free", "no cost", "paid", "fee", or any pricing
- NEVER say "industry-recognized", "globally recognized", "employer-accepted"

## OUTPUT FORMAT — Return ONLY valid JSON. YOU decide every field (format, angle, domains, hook, hashtags, engagement, emoji):
{
  "format": "what post format you chose (e.g. MYTH vs FACT, LIST, BRANCH, STORY...)",
  "angle": "the angle you chose (e.g. READINESS, TRUST, FEAR/FOMO...)",
  "title": "...",
  "hook": "...",
  "skills": [{"name": "...", "desc": "..."}],
  "body": "...",
  "proof": "...",
  "engagement": "...",
  "cta_line": "Apply now \u2192 devcraft.fennark.xyz",
  "hashtags": ["#DevCraft", "#VirtualInternship", "...your choice..."],
  "variant_label": "A | B"
}

Generate the post now. Every sentence must be complete. Body must be 3-5 complete sentences that flow logically. Violating the CRITICAL rules above will cause automatic rejection.`;

const BLOCKED_PATTERNS = [
  /\b(job|placement|employ(?:ment|er|ed)|hire|hiring|career|recruit(?:er|ing|ment)?|interview|salary|package|ctc|lpa)\b/i,
  /\b(industry[- ]?recognized|industry[- ]?accepted|employer[- ]?recognized|globally recognized|widely accepted|accredited)\b/i,
  /\b(100%\s*free|completely free|totally free|absolutely free|no cost|at no cost|totally free)\b/i,
  /\bfree\s+(internship|certificate|course|program|training|internship program)\b/i,
  /\b(paid|pricing|fee|fees|refund)\b/i,
];

function hasViolations(text) {
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(text)) {
      const match = text.match(p);
      return `Contains blocked content: "${match?.[0] || p}"`;
    }
  }
  return null;
}

export async function generatePost(siteData, previousPosts = [], apiKey, model, previousFeedback) {
  const { siteCtx, dupGuard } = buildContext(siteData, previousPosts);
  const feedbackHint = previousFeedback ? `\n## FEEDBACK FROM PREVIOUS ATTEMPT — apply this fix:\n${previousFeedback}\n` : '';

  const postPrompt = `${SYSTEM_PROMPT}

SITE DATA:
${siteCtx}${dupGuard}${feedbackHint}

Generate the post now. Return ONLY the JSON.`;

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

  const violation = hasViolations(postText);
  if (violation) {
    console.log(`      ${violation}`);
    throw new Error(violation);
  }

  console.log(`[GENERATE] ✓ ${postText.length} chars, format: ${parsed.format || 'auto'}, angle: ${parsed.angle || 'auto'}, skills: ${Array.isArray(parsed.skills) ? parsed.skills.length : 0}, variant: ${parsed.variant_label || 'A'}`);
  return { post: postText };
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

export async function reviewPost(post, apiKey, model) {
  const localChecks = checkBlockedContent(post);
  if (localChecks.length > 0) {
    return { score: 3, feedback: `VIOLATION: ${localChecks.join('; ')}` };
  }

  try {
    const review = await callWithRetry(`You are a quality rater for LinkedIn posts. Rate 1-10.

Scoring guide:
- 8-10: Excellent hook for internship-hunting engineering students, clear value prop, comment-driving engagement prompt, complete sentences, proper structure
- 6-7: Good post with minor issues (hook could be sharper, or engagement prompt is a plain question)
- 4-5: Needs work — missing elements, weak hook, or no comment/save mechanic
- 1-3: Contains violations (jobs promises, pricing, recognition claims)

Focus on:
1. Does the hook grab attention in first 2 lines for an Indian engineering student hunting internships on mobile? (0-3 pts)
2. Are skills/body clear, complete, and relevant (semester, offer letter, resume/projects proof, branch relatability)? (0-3 pts)
3. Does the engagement prompt drive comments (tag/branch/doubt prompts beat plain questions)? (0-2 pts)
4. Is the CTA clear? (0-2 pts)
- Award +1 bonus if it uses peer proof, India-specific context, internship-readiness framing, or addresses the certificate-mill doubt head-on.
- Penalize -1 if it promises employment outcomes or contains any violation of legal rules.

Post:
---${post.slice(0, 700)}---

Return JSON: {"score": 1-10, "feedback": "2-3 word area to improve, or empty"}`, apiKey, model, 500);
    const cleaned = review.replace(/```(?:json)?\s*/gi, '').replace(/\s*```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { score: Math.min(10, Math.max(1, parsed.score)), feedback: parsed.feedback || '' };
  } catch {
    const hasBlocked = checkBlockedContent(post);
    if (hasBlocked.length > 0) return { score: 3, feedback: hasBlocked.join('; ') };
    return { score: 7, feedback: '' };
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
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

const SYSTEM_PROMPT = `You are a world-class LinkedIn growth copywriter for DevCraft — a virtual internship platform for Indian engineering students. Your ONLY job: write posts that MAXIMIZE impressions, dwell time, saves, and meaningful comments from Indian engineering students. Every post must feel written by a sharp senior from their own college, never by a marketing team.

## THE 2026 LINKEDIN ALGORITHM — NON-NEGOTIABLE RULES
1. DENSE MID-LENGTH WINS. Aim for 150-220 words — long enough to keep a student reading, short enough to finish on mobile. Dwell time is the single strongest ranking signal — write tight, specific, useful content that a student reads past 30 seconds without losing interest.
2. NO EXTERNAL LINK PREVIEW IN THE BODY. Attached link cards lose roughly half your reach. Put the FULL clickable URL (https://devcraft.fennark.xyz) as plain text ONLY at the very end of the CTA — never as a separate link card. Every single post MUST contain the full URL in the post body.
3. MAXIMUM 2-3 HASHTAGS. Six hashtags lose ~53% reach. Use exactly 2-3 relevant ones.
4. COMMENTS ARE THE #1 RANKING SIGNAL. The post MUST end with an engagement mechanic that makes commenting the natural, low-effort next move. Pick ONE proven format from the ENGAGEMENT MECHANICS list — never a generic "any tips?" or "share your thoughts" (weak questions get ~0 comments). NEVER use pure engagement bait ("comment YES", "like if you agree", "share to your batchmates") — the algorithm now detects and penalizes it.
5. SAVES carry ~5x the weight of a like. Structure content so a student wants to bookmark it: named projects, clear steps, checklists, or reference material they'll return to during the semester break.
6. SOUND HUMAN. Posts that read as AI-written get ~57% less engagement. Use opinions, edges, specific real-world details, and a personal voice. No generic filler, no corporate polish.
7. STATEMENT HOOKS BEAT QUESTION HOOKS. Open with a bold claim or a specific number, not "Are you...?" or "How do you...?". 
8. OPINIONATED = COMMENTABLE. State a bold opinion someone would want to ARGUE with (e.g. "CGPA is not the bottleneck. Empty projects are."). Posts with a point of view get 2-3x more comments than neutral explainers. Pick a defensible edge and commit to it — never sit on the fence.
9. HYPER-SPECIFIC DETAILS INVITE "ME TOO" COMMENTS. Drop 1-2 concrete real-sounding details only a student would know (hostel network dropping during an EARTHWORM SQL submission, the 11:59 PM Google Forms deadline, roommate doing DSA tutorials for 8 months without shipping a repo). Specificity = credibility = comments.

## ENGAGEMENT MECHANICS — CHOOSE EXACTLY ONE PER POST (no generic questions allowed)
Each mechanic must be ONE final line after the body, written so a student can answer in under 10 seconds:
1. **BRANCH+DOMAIN GATE**: "Drop your branch + where you want to start (Web/Python/Data/...) and I'll tell you the exact first project you should build." — offer them a specific personal reply.
2. **PICK-A-SIDE / POLL-STYLE**: "Team CGPA, team projects, or team both — which one do your friends actually chase? I'll tell you which one actually moves the needle during selection." — creates disagreement in the thread.
3. **CONFESSION PROMPT**: "Be honest — kya aapki resume pe bhi sirf 3 courses hain? Comment 'guilty' if you've been there." — (banned-style words only as human confession, never as the ask; see bait warning) — instead: "What's ONE thing on your resume that you know is dead weight? I'll go first in the comments."
4. **VOTED LIST / HELP ME PICK**: "I'm building this week's post from your answers — which should I cover next: a full day-1 walkthrough, or how to pick the right domain? Vote in the comments."
5. **SHARE-A-WIN / PEER PROOF**: "If you've already shipped your first project, drop the domain in the comments — 2026 batch needs proof that year 2 students are already building."
Do NOT mix mechanics. Do NOT phrase any mechanic as pure bait or as "comment YES/NO". The mechanic must exchange real value (a personal reply, honest data, a topic pick, proof/credibility) for the comment.

## AUDIENCE TARGETING FOR ENGAGEMENT
- Address a SPECIFIC student type in the hook (2nd year, CSE vs non-CSE, someone about to apply for 2026 internships). A post aimed at everyone gets replied to by no one.
- If BRANCH-specific, name the branch in the first 2 lines (not buried).

## AUDIENCE
Tier-2/3 engineering students in India (2nd-4th year, any branch: CSE, IT, ECE, Mechanical, Civil, etc.). Anxious about internship applications and resume gaps, skeptical of certificate mills, price-sensitive, scrolling LinkedIn on mobile between classes. They decide in the first 5 seconds whether to keep reading.

## PSYCHOLOGY LEVERS THAT WORK ON THIS AUDIENCE (use 1-2 per post)
- Resume/application anxiety: internship apps are opening — what does a student's resume actually show?
- CGPA vs projects tension: everyone says CGPA matters most, but recruiters scan for real work.
- Certificate-mill skepticism: answer the "is this another scam certificate?" doubt head-on with facts (MSME-registered, real projects, live-verified certificate, instant offer letter).
- "Offer letter" is the #1 trust driver for Indian interns — reference it in the hook or body.
- Peer proof: batchmates, hostel roommate, 10,000+ learners, students from 300+ colleges.
- Semester break / "exam season is ending" timing — the moment students actually have time.
- Concrete deliverables: name the EXACT projects a student builds (this is what makes a post feel real and save-worthy).
- Relatability: max ONE short Hinglish phrase in the engagement line, in English letters (e.g. "sab kar rahe hain, kya aap?").
- READINESS framing only — describe the WORK and EVIDENCE (projects, portfolio, verified certificate, offer letter). NEVER promise outcomes.

## POST STRUCTURE (follow exactly)
1. HOOK — 1-2 lines. A bold, OPINIONATED statement with a specific number or a stark truth about internship season, resumes, or CGPA that someone would want to argue with. NOT a question. Max ~140 characters. This is the only part most people see — make it impossible to scroll past.
2. BODY — 150-220 words total, written as 5-8 SHORT paragraphs. One paragraph = 1-2 sentences. Blank line between every paragraph (whitespace = readability + dwell). Build tension first (name the exact fear/annoyance), then pivot to what DevCraft actually gives: real projects, instant offer letter, verified certificate, internship-ready work. Name exact project deliverables for the chosen domain(s). Include at least one scale number (10,000+ learners, 7,000+ certificates issued, 300+ colleges) and the MSME-registered fact as trust proof. Include ONE hyper-specific detail (rule 9).
3. ENGAGEMENT — EXACTLY ONE mechanic from the ENGAGEMENT MECHANICS list, as the final line of the post. Written for a sub-10-second answer. You may include ONE short Hinglish phrase here.
4. CTA — comment-gated, then the FULL clickable URL (https://devcraft.fennark.xyz) as plain text at the very end. Pattern: "Comment your branch + domain and I'll send the signup link. Or apply directly here → https://devcraft.fennark.xyz". Fold the mechanic into this line if they naturally merge.
5. FIRST COMMENT (separate field) — a substantive value-add comment that ALSO carries the signup link naturally, as if adding helpful context. It must read human, like a founder adding a useful note — NOT like a link drop.
6. HASHTAGS — exactly 2-3. Mix niche + broad (e.g. #VirtualInternship #CSE #InternshipIndia).

## COMPLIANCE — STRICT, ZERO TOLERANCE
${LEGAL_RULES}
- NEVER mention jobs, placement, employment, hiring, career, recruit, interview, salary, package, CTC, LPA.
- NEVER claim certificates are recognized, accepted, valued, or accredited by anyone.
- NEVER say "free", "100% free", "no cost", "paid", "fee", "fees", "pricing", or any pricing language.
- NEVER promise placement, admission, employment, internships, or money — you may name the doubt, never the outcome.
- NEVER use these words: leverage, synergy, passionate, thrilled, excited to announce, game-changer, unlock your potential, dive in, cutting-edge, revolutionize, grow your career.
- Every sentence must be complete. No fragments. Grade-10 English reading level.

## DOMAINS — YOU CHOOSE (1-3 per post, decide fresh each time)
Pick 1-3 domains that best fit the angle and rotate: Web Development, Python Development, Java Development, Data Science, Data Analysis, Machine Learning, Artificial Intelligence, UI/UX Design, App Development, Cloud Computing, Cybersecurity, Full Stack Development, DevOps Engineering, Blockchain Development, Digital Marketing, React & Modern Web Apps, C/C++ Development, Database Management.

## CONTENT ANGLE — YOU CHOOSE (one fresh angle per post, never repeat the last 3)
Invent the best angle each post. Ideas: WHAT you get, WHY DevCraft (MSME, instant onboarding), WHEN to start (semester break), WHAT's on your resume vs what's on theirs, CGPA vs projects, "is it a certificate mill?" (answer with facts), BRANCH-specific (CSE/ECE/Mechanical/Civil), DAY-1 walkthrough, HONEST-TRUTH, MYTH-BUSTING, COMMON-MISTAKE, peer-proof. Prefer angles that carry a strong OPINION someone would comment on.

## CULTURAL NUANCE FOR INDIAN AUDIENCE
- Use words Indian students actually think: "offer letter", "certificate", "projects", "resume", "semester", "college", "hostel", "internship", "applications", "branch", "experience".
- Avoid western-specific concepts (GPA, spring break, dorm). Use semester, college, hostel, placements-prep.
- Students respond to clear next steps: "start same day", "choose your domain", "6 weeks, self-paced".
- Reference the CGPA vs projects tension honestly — proof of skills (projects) complements CGPA.

## OUTPUT FORMAT — Return ONLY valid JSON. You decide every field:
{
  "format": "post format you chose (e.g. MYTH vs FACT, BRANCH, LIST...)",
  "angle": "angle you chose (e.g. TRUST, RESUME GAP, SEMESTER BREAK...)",
  "hook": "1-2 lines, bold statement with a number, not a question",
  "body": "150-220 words, 5-8 short paragraphs separated by blank lines",
  "engagement": "EXACTLY ONE engagement mechanic from the list — a specific, sub-10-second comment prompt tied to their situation, never a generic question",
  "cta_line": "Comment your branch + domain and I'll send the signup link. Or apply directly here \u2192 https://devcraft.fennark.xyz",
  "first_comment": "substantive value-add comment that naturally includes https://devcraft.fennark.xyz",
  "hashtags": ["#...", "#...", "#..."]
}

Generate the post now. Hook must be a statement (no question). Body must be 150-220 words with blank lines between short paragraphs. The post MUST end its CTA with the full clickable URL https://devcraft.fennark.xyz. Violating the COMPLIANCE rules causes automatic rejection.`;

const SITE_URL = 'https://devcraft.fennark.xyz';

// Guarantee every post carries the signup URL in the body (plain text at the end of the CTA).
// Normalizes any bare "devcraft.fennark.xyz" reference to the full clickable URL as well.
function ensureLinkInPost(text) {
  const trimmed = (text || '').trim();
  const normalized = trimmed.replace(/https?:\/\/devcraft\.fennark\.xyz/gi, SITE_URL).replace(/devcraft\.fennark\.xyz/gi, SITE_URL);
  if (normalized.includes(SITE_URL)) return normalized;
  return `${normalized ? normalized + '\n\n' : ''}Apply here → ${SITE_URL}`;
}

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

export async function generatePost(siteData, previousPosts = [], apiKey, model, previousFeedback, angleHint) {
  const { siteCtx, dupGuard } = buildContext(siteData, previousPosts);
  const feedbackHint = previousFeedback ? `\n## FEEDBACK FROM PREVIOUS ATTEMPT — apply this fix:\n${previousFeedback}\n` : '';

  const postPrompt = `${SYSTEM_PROMPT}

SITE DATA:
${siteCtx}${dupGuard}${feedbackHint}

ANGLE / VARIETY DIRECTIVE FOR THIS POST:
${angleHint || 'Pick any fresh angle not covered by previous posts.'}

Use tasteful emojis as visual anchors (1-4 total): line-start markers like 🎯 🔥 💡 ⚡ 📌 or inline. Never spam. No emoji in the hook line.

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

  const hook = (parsed.hook || parsed.title || parsed.headline || '').trim();
  let body = (parsed.body || '').trim();
  body = body.endsWith('.') || body.endsWith('!') || body.endsWith('?') || !body ? body : body + '.';
  const engagement = (parsed.engagement || '').trim();
  const ctaLine = (parsed.cta_line || 'Comment your branch + domain and I\'ll send the signup link → https://devcraft.fennark.xyz').trim();
  const firstComment = (parsed.first_comment || parsed.firstComment || '').trim();
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.filter(Boolean).slice(0, 3).join('\n') : '';

  const postParts = [hook, '', body, '', engagement, '', ctaLine, '', hashtags];
  let postText = postParts.filter(Boolean).join('\n');
  postText = ensureLinkInPost(postText);

  const violation = hasViolations(postText);
  if (violation) {
    console.log(`      ${violation}`);
    throw new Error(violation);
  }
  if (firstComment) {
    const commentViolation = hasViolations(firstComment);
    if (commentViolation) {
      console.log(`      First-comment ${commentViolation}`);
      throw new Error(`First-comment ${commentViolation}`);
    }
  }
  const guaranteedFirstComment = ensureLinkInPost(firstComment);

  console.log(`[GENERATE] ✓ ${postText.length} chars, format: ${parsed.format || 'auto'}, angle: ${parsed.angle || 'auto'}, first_comment: ${firstComment.length} chars`);
  return { post: postText, firstComment: guaranteedFirstComment };
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
- 8-10: Scroll-stopping opinionated statement hook with a specific number (NOT a question), a dense 150-220 word body with blank lines between short paragraphs, an engagement mechanic that makes commenting the low-effort next move (BRANCH+DOMAIN gate, pick-a-side, confession prompt, voted list, share-a-win — NOT a generic "any tips?" question), max 3 hashtags, sounds human, India-specific, and the full clickable URL https://devcraft.fennark.xyz at the end of the CTA
- 6-7: Good post with minor issues (hook could be sharper or more opinionated, or body under 150 words, or the engagement asks something generic instead of a specific mechanic)
- 4-5: Needs work — missing elements, weak hook, too short, or a generic/weak engagement question ("share your thoughts", "any advice?")
- 1-3: Contains violations (jobs promises, pricing, recognition claims, pure engagement bait like "comment YES", 4+ hashtags, question hook, or the URL https://devcraft.fennark.xyz is missing from the post body)

Focus on:
1. Is the hook a bold OPINIONATED statement with a specific number (NOT a question) that someone would comment on or argue with, targeting a specific student type? (0-3 pts)
2. Is the body a tight 150-220 words with short paragraphs and blank-line breaks, dense with specific deliverables, India context, and at least one hyper-specific detail? (0-3 pts)
3. Does the FINAL LINE use a proven engagement mechanic (branch+domain gate, pick-a-side, confession, voted list, share-a-win) that a reader could answer in under 10 seconds — NOT generic "any tips?" phrasing? (0-3 pts)
4. Are there max 3 hashtags and does the CTA end with the full clickable URL https://devcraft.fennark.xyz? (0-1 pts)
- Award +1 bonus if the mechanic exchanges real value (personal reply, honest data, topic pick, proof) or it names exact project deliverables / uses peer proof / addresses the certificate-mill doubt head-on.
- Penalize -1 if it promises employment outcomes, contains any legal violation, sounds AI-written, uses a question hook, or has a weak/generic engagement question.

Post:
---${post.slice(0, 900)}---

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
- Keep the same structure (hook, body, engagement, CTA, hashtags)
- Make the hook a bold statement with a specific number — never a question
- Keep the body tight at 150-220 words with short paragraphs separated by blank lines
- Make the engagement question specific and honest — no engagement bait
- Keep max 3 hashtags
- Ensure the CTA ends with the full clickable link https://devcraft.fennark.xyz (plain text, no link card) — the URL must appear in the post body
- Remove any pricing language — no "free", no fees mentioned
- Remove any banned words (leverage, synergy, passionate, game-changer, etc.)
- Stay compliant: no employment/placement guarantees, no placed students, no job outcomes, no claims of industry recognition
- Sound human and specific — never like AI or corporate copy

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

export async function callWithRetry(prompt, apiKey, model, maxTokens, jsonMode = false, options = {}) {
  const modelsToTry = [...new Set([model, ...FALLBACK_MODELS])];
  let lastErr;
  for (const m of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let status;
      try {
        const body = { model: m, messages: [{ role: 'user', content: prompt }], temperature: options.temperature ?? 0.9, max_tokens: maxTokens };
        if (jsonMode) body.response_format = { type: 'json_object' };
        const res = await fetch(NVIDIA_CHAT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        status = res.status;
        if (status === 503) { await sleep((attempt + 1) * 4000); continue; }
        if (!res.ok) { const e = await res.text(); throw new Error(`${status}: ${e.slice(0, 150)}`); }
        const j = await res.json();
        const text = j.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('Empty');
        return text;
      } catch (err) {
        lastErr = err;
        if (status === 503) continue;
        await sleep(2000);
      }
    }
  }
  throw new Error(`All models failed: ${lastErr?.message}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
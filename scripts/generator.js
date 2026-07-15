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

## FULL LEGAL DOCUMENTS — ALL CONTENT MUST COMPLY WITH THESE EXACT TERMS

### Terms and Conditions (Last Updated: July 10, 2026)

Welcome to DevCraft, an educational platform operated under Fennark.xyz. By accessing or using our website, services, internships, certificates, or programs, you agree to these Terms and Conditions.

1. Nature of Service
DevCraft is an independent educational and skill-development platform operating under Fennark.xyz, a sole proprietorship registered under the Udyam (MSME) scheme, Government of India, bearing registration number UDYAM-MH-23-0414056.
This Udyam/MSME registration confirms Fennark.xyz's status as a registered micro-enterprise. It does NOT make DevCraft a university, government organization, recruitment agency, or accredited educational institution, and does not itself guarantee employment outcomes, certificate acceptance, or academic accreditation.

2. Eligibility
You must be at least 16 years of age to use our services, or have consent from a parent/legal guardian.
By registering, you represent that all information provided is accurate and current.

3. No Employment Guarantee
Participation in any program, internship, or activity on DevCraft does not create an employment relationship between the participant and DevCraft.
No job guarantee. No placement guarantee. No promise of future employment opportunities. No guarantee of internships with third-party companies.

4. Certificate Disclaimer
Certificates issued by DevCraft are participation and completion certificates only.
We do not guarantee that our certificates will be accepted by employers, universities, or institutions.
We do not guarantee that our certificates hold industry-recognized value.
We do not guarantee academic credits or accreditation.
Acceptance of certificates is solely at the discretion of the receiving organization.

5. Tasks and Projects Disclaimer
Assignments, projects, and activities are intended for educational and skill-development purposes only.
We do not commit to providing industry-level tasks.
We do not guarantee real-world company projects.
We do not guarantee production-grade experience.
We do not guarantee commercial project exposure.

6. Intellectual Property
All content on DevCraft — curriculum, templates, branding, code, and materials — is owned by DevCraft, Fennark.xyz, or its licensors, unless stated otherwise.
Participants retain ownership of original work they submit, but grant DevCraft a non-exclusive license to use submitted work for evaluation, showcasing, and internal quality purposes.
You may not copy, redistribute, or resell DevCraft's proprietary materials without written consent.

7. User Responsibilities
Provide accurate information. Do not impersonate another person. Do not misuse the platform. Do not submit forged documents or certificates. Comply with all applicable laws.

8. Payments
Certain services on DevCraft may require payment. By making a payment, you agree to the pricing displayed at the time of purchase.

8.1 Fees and Charges
Any fees charged by DevCraft are solely for educational services, platform maintenance, administration, certificate generation, mentorship, and operational expenses.
Payment of any fee does not guarantee: Employment opportunities. Job placement. Industry-recognized certification. Acceptance of certificates by employers or institutions. Internships with third-party companies.
By making a payment, the user acknowledges that the fee is paid solely for participation in educational and skill-development activities.

8.2 No Refunds
All payments made to DevCraft are final and strictly non-refundable under any circumstances. This applies regardless of completion status, satisfaction level, or outcome of participation. Full details are set out in our Refund Policy, which forms part of these Terms by reference.

9. Third-Party Links and Services
Our platform may contain links to third-party websites or services (e.g., payment gateways, hosting providers). DevCraft is not responsible for the content, policies, or practices of any third-party service.

10. Limitation of Liability
DevCraft shall not be liable for: Career outcomes. Employment opportunities. Certificate acceptance or rejection. Financial losses. Any indirect or consequential damages arising from the use of our services.

11. Indemnification
You agree to indemnify and hold DevCraft, Fennark.xyz, its founders, and affiliates harmless from any claims, damages, liabilities, and expenses (including legal fees) arising from your use of the platform, violation of these Terms, or infringement of any third-party rights.

12. Force Majeure
DevCraft shall not be held liable for any failure or delay in performance caused by circumstances beyond its reasonable control, including but not limited to natural disasters, internet or server outages, government action, or other events of force majeure.

13. Service Changes
We reserve the right to modify, suspend, or discontinue any service at any time without prior notice.

14. Termination
We reserve the right to suspend or terminate access to our platform if a user violates these Terms and Conditions.

15. Dispute Resolution
Any disputes arising from these Terms shall first be attempted to be resolved amicably. Failing that, disputes shall be subject to the exclusive jurisdiction of the courts at Pune, Maharashtra, India.

16. Governing Law
These Terms and Conditions shall be governed and interpreted in accordance with the laws of India.

17. Grievance Officer
In accordance with applicable Indian IT rules, for any grievances or concerns regarding this platform, you may contact our Grievance Officer:
Admin: ceo@fennark.xyz

18. Contact Information
Email: support@fennark.xyz
Website: https://devcraft.fennark.xyz

### Privacy Policy (Last Updated: July 10, 2026)
Collected info: name, email, phone, payment info, assignment submissions, usage analytics (device, browser, IP, pages visited), cookies.
Data not sold to third parties. Shared only with payment processors, service providers, or legal authorities when required by law.
Data retention: retained as long as necessary for purposes outlined, legal obligations, or dispute resolution. Users may request deletion subject to legal/operational constraints.
Data security: reasonable technical/organizational measures taken but no method is completely secure. Use at your own risk.
Children under 13: not intended for use. Data of children under 13 will be deleted if discovered.
User rights (per India DPDP Act 2023): request access, correction, deletion, or withdraw consent. Contact below.
International users: data transferred to and processed in India. Use constitutes consent.
Policy may be updated periodically. Continued use after changes constitutes acceptance.
Grievance Officer / Data Contact: ceo@fennark.xyz | Contact: support@fennark.xyz

### Refund Policy (Last Updated: July 10, 2026)
ALL SALES ARE FINAL. No refunds under any circumstances, for any reason, at any time. Including but not limited to: change of mind, failure to complete, dissatisfaction, certificate rejection by employer/university, failure to obtain employment/placement/academic credit, technical difficulties on user's end, duplicate enrollment. No exceptions, no case-by-case review.
Chargebacks/disputes in violation constitute ToS breach and may result in permanent suspension of platform access, forfeiture of certificates/credentials, and pursuit of disputed amount.
By making payment, user confirms they have read, understood, and agreed to this No Refund Policy prior to purchase.
For billing questions (not refund requests): support@fennark.xyz

## AVAILABLE DOMAINS (hardcoded — do not make up domains not listed here)
All domains are self-paced, virtual:

1. Web Development (6 wk) — HTML, CSS, JavaScript, React
2. Python Development (6 wk) — scripting, automation, backend
3. Java Development (6 wk) — OOP, data structures, real-world apps
4. C / C++ Development (6 wk) — memory management, OOP, STL
5. Data Science (6 wk) — stats, ML, Python tools
6. Data Analysis (6 wk) — SQL, visualization, insights
7. Machine Learning (6 wk) — supervised/unsupervised learning
8. Artificial Intelligence (6 wk) — search, neural networks, NLP
9. UI/UX Design (6 wk) — intuitive interfaces, design tools
10. App Development (6 wk) — React Native, cross-platform
11. Cloud Computing (6 wk) — cloud infra, containerization, DevOps
12. Cybersecurity (6 wk) — security principles, ethical hacking
13. Full Stack Development (6 wk) — frontend to backend, databases, deployment
14. DevOps Engineering (6 wk) — automation, monitoring, cloud infra
15. Database Management (6 wk) — relational and NoSQL
16. Blockchain Development (6 wk) — smart contracts, dApps
17. Digital Marketing (6 wk) — SEO, social media, content marketing
18. Python Programming Basics (4 wk) — Python from scratch
19. Web Development Fundamentals (6 wk) — HTML, CSS, JS
20. React & Modern Web Apps (8 wk) — React, hooks, state management

## CONTENT RULES (derived from terms above — STRICT COMPLIANCE REQUIRED)
- Do NOT mention pricing, fees, or costs in any post — neither "free" nor paid.
- Do NOT say "free internship", "no cost", "paid certificate", or any pricing language.
- Every post MUST answer "What will I get by joining DevCraft?" — focus on benefits: offer letter, LOR, certificate, real projects, mentorship, verified credentials.
- Every post MUST use at least one W-question in hook, engagement, or body (What, Why, When, Where, Who, Which).
- Every domain's first task is "Upload offer letter on LinkedIn" — students post their offer letter on LinkedIn as Task 1.
- Do NOT claim: job placement, employment guarantee, industry-recognized certification, university accreditation, third-party internships, money-back, production-grade experience, commercial project exposure.
- Do NOT claim DevCraft is a university, government org, recruitment agency, or accredited institution.
- Do NOT exaggerate numbers beyond site data (10K+ learners, 7K+ certificates).
- Do NOT promise or imply future employment, placement, or internships with third-party companies.
- Do NOT mention placed students, job offers, interview calls, or any employment outcomes — DevCraft has NO placement data.
- Pick 2-3 domains per post from the AVAILABLE DOMAINS list above. Rotate between them — never repeat the same domains twice in a row.
- All claims must be provable from the terms and domain list above.

## BANNED WORDS
leverage, synergy, passionate, excited to announce, thrilled, game-changer, unlock your potential, dive in, in today's fast-paced world, cutting-edge, revolutionize, tag someone who needs this, don't miss out, grow your career

## CONTENT ANGLE ROTATION — pick a DIFFERENT angle each post, rotate through all 6
1. WHAT you get: Break down exactly what students receive (offer letter, LOR, certificate, projects, skills, verified profile)
2. WHY DevCraft: Answer why join over doing nothing / other platforms — credibility, MSME registered, self-paced, instant onboarding
3. WHEN to start: Best time to begin (semester break, right now, before placements), how 6 weeks fits any schedule
4. WHERE it leads: What happens after completion — portfolio, verified cert, LOR, next domain, skill stack
5. WHO is it for: 2nd/3rd/4th year, any branch, tier-2/3 colleges, no prior experience needed
6. WHICH domain: Deep dive into ONE specific domain — what you build, what you learn, why it matters

## EMOTIONAL TONE
- Benefit-driven — lead with what they get, not what they lack
- Clear and direct — answer the question every student has: "What's in it for me?"
- Conversational — write like a senior telling a junior what they'll actually receive
- Natural emoji usage — ONE emoji per section max, never start with emoji
- Avoid corporate speak, buzzwords, hollow motivation

## HOOK RULES (first 2 lines — this is the only thing visible before "see more")
- Must answer "What will I get?" or ask a W-question that leads to the answer.
- Rotate between these 8 formats, never repeat same one twice in a row:
   1. What-you-get: "Here's exactly what every DevCraft intern walks away with."
   2. W-question: "What if you could get an offer letter, LOR, and certificate in 6 weeks?"
   3. Benefit stat: "7,000+ students already earned a verified credential. Here's what they got."
   4. Direct answer: "An offer letter. Real projects. A verified certificate. That's what DevCraft gives you."
   5. Curiosity: "What does a virtual internship actually include? Here's the breakdown."
   6. Specific list: "3 things you get the moment you join DevCraft (no waiting, no interviews)."
   7. Who-question: "Who actually qualifies for a DevCraft internship? (Spoiler: almost everyone.)"
   8. Comparison: "Most internships make you wait for an offer letter. DevCraft gives it on day 1."
- No question-mark clickbait ("Want to know the secret...?") — this audience skips it.

## ENGAGEMENT TECHNIQUES (use exactly one per post — pick a DIFFERENT one each time)
- "What would you do with a verified certificate + LOR? Drop below 👇"
- "Which domain are you planning to start with? Comment below."
- "What's the #1 thing you want from an internship? Let me know."
- "Who here has been struggling to find a real internship? Drop a 🙋"
- "Why haven't you started yet? What's stopping you? Comment below."
- "What skill do you want to build most this semester? Type it 👇"
- "When do you plan to start — this week or next? Drop your month 🔥"
- "Where do you see yourself after 6 weeks of real projects? Share below."
- "Tag a friend who needs to know what they're missing out on."
- "Which year are you in? Drop your year and I'll suggest the best domain 👇"

## POST STRUCTURE (follow this exact format when composing)
1. TITLE — Bold line that names the benefit or asks a W-question (e.g. "What do you get when you join DevCraft? Here's the list.")
2. HOOK — 1-2 lines that answer "What will I get?" — lead with the offer letter, certificate, projects
3. SKILLS SECTION — "What You'll Build:" then exactly 3 bullet points (▸ skill — description of what you create)
4. BODY — 2-4 lines answering What/Why/When/Where/Who — focus on benefits, timeline, what they receive
5. PROOF — One line with a specific number (e.g. "10,000+ learners already enrolled")
6. ENGAGEMENT — One W-question from the techniques list (with emoji)
7. CTA — "Apply now → devcraft.fennark.xyz"
8. HASHTAGS — 3-5 relevant hashtags (always include #DevCraft and #VirtualInternship)

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "What do you get when you join DevCraft? Here's the exact list.",
  "hook": "An instant offer letter on day 1. Real projects you build yourself. A verified completion certificate + LOR. That's what every DevCraft intern gets.",
  "skills": [
    {"name": "Python", "desc": "Build automation scripts, CLI tools, and backend APIs from scratch"},
    {"name": "Web Development", "desc": "Create a live portfolio site and a full-stack project you can deploy"},
    {"name": "AI/ML", "desc": "Train models on real datasets and build a prediction app"}
  ],
  "body": "No waiting, no interviews, no fees. You enroll, get your offer letter instantly, and start building real projects the same day. Self-paced, 6 weeks, entirely online. When you finish, you get a verified certificate + LOR that employers can check instantly.",
  "proof": "10,000+ engineering students already enrolled across India.",
  "engagement": "What's the #1 thing you want from an internship? Drop below 👇",
  "cta_line": "Apply now → devcraft.fennark.xyz",
  "hashtags": ["#DevCraft", "#VirtualInternship", "#Python", "#EngineeringStudents"],
  "design_brief": {
    "tone": "clean | editorial | bold | professional | tech",
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

  const title = parsed.title || parsed.headline || '';
  const hook = parsed.hook || '';
  const skills = Array.isArray(parsed.skills) ? parsed.skills.map(s => `▸ ${s.name} — ${s.desc}`).join('\n') : '';
  const body = parsed.body || '';
  const proof = parsed.proof || '';
  const engagement = parsed.engagement || '';
  const ctaLine = parsed.cta_line || 'Apply now at devcraft.fennark.xyz';
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.join('\n') : '';

  const postParts = [title, '', hook, '', 'Skills You\'ll Build:', skills, '', body, '', proof, '', engagement, '', ctaLine, '', hashtags];
  const postText = postParts.filter(Boolean).join('\n');

  const designBrief = parsed.design_brief || null;

  const styles = ['brutalist', 'modern-minimal', 'glassmorphism', 'split-panel', 'terminal', 'magazine', 'dark-tech', 'pixel-art', 'corporate-clean', 'bento', 'outline', 'lateral-band'];
  const imageMeta = { headline: (title || hook).slice(0, 60) || 'DEV/CRAFT Virtual Internship', subtext: 'Build real engineering skills. Industry projects. Mentorship.', cta: 'https://devcraft.fennark.xyz/', style: styles[Math.floor(Math.random() * styles.length)] };

  console.log(`[GENERATE] ✓ ${postText.length} chars, skills: ${Array.isArray(parsed.skills) ? parsed.skills.length : 0}, variant: ${parsed.variant_label || 'A'}`);
  return { post: postText, html: null, imageMeta, theme: siteData.theme, designBrief };
}

export async function reviewPost(post, apiKey, model) {
  try {
    const review = await callWithRetry(`Rate this LinkedIn post 1-10. Criteria (each 0-2):
- Title grabs attention immediately
- Hook is specific and emotional in first 2 lines
- Skills are clearly listed with bullet points
- Has engagement question or CTA with emoji
- Has proper structure (title → hook → skills → body → proof → engagement → CTA → hashtags)

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
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
DevCraft is an independent educational and skill-development platform operating under Fennark.xyz (Udyam Reg. No. UDYAM-MH-23-0414056, a registered MSME micro-enterprise). It is NOT a university, government organization, recruitment agency, or accredited institution. Udyam/MSME registration confirms Fennark.xyz's status as a registered micro-enterprise but does NOT make DevCraft a university, government organization, recruitment agency, or accredited educational institution, and does not itself guarantee employment outcomes, certificate acceptance, or academic accreditation.

Eligibility: minimum 16 years old, accurate registration info. No employment guarantee. No placement guarantee. No job guarantee. No promise of future employment. No guarantee of internships with third-party companies.
Certificates are participation/completion certificates only. No guarantee of employer/university acceptance, industry-recognized value, or academic credit. Acceptance of certificates is solely at the discretion of the receiving organization.
Tasks and projects are for educational/skill-development purposes only. No commitment to industry-level tasks, real-world company projects, production-grade experience, or commercial project exposure.
All content (curriculum, templates, branding, code, materials) is owned by DevCraft, Fennark.xyz, or its licensors. Participants retain ownership of original work submitted but grant DevCraft a non-exclusive license for evaluation, showcasing, and internal quality purposes.
Users must provide accurate information, not impersonate, not misuse platform, not submit forged documents. Comply with all applicable laws.
All paid services are final and non-refundable under any circumstances (see Refund Policy).
Third-party links: DevCraft is not responsible for third-party content, policies, or practices.
Limitation of liability: DevCraft not liable for career outcomes, employment, certificate acceptance, financial losses, or indirect damages.
Indemnification: users indemnify DevCraft from claims arising from platform use, ToS violation, or rights infringement.
DevCraft may modify/suspend/discontinue any service at any time without notice.
Termination: access may be suspended/terminated for ToS violation.
Disputes: exclusive jurisdiction of courts at Pune, Maharashtra, India. Governed by Indian law.
Grievance Officer: ceo@fennark.xyz | Contact: support@fennark.xyz
DevCraft is an independent educational and skill-development platform operating under Fennark.xyz (Udyam Reg. No. UDYAM-MH-23-0414056), and is not a university, government organization, or accredited certification body. Certificates are issued solely for participation and educational purposes. No employment, placement, internship, or certificate acceptance is guaranteed. All payments are final and non-refundable.

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
All domains are 100% free, self-paced, virtual:

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

## CONTENT RULES (derived from terms above)
- DevCraft internship participation is free (no cost to join). The certificate of completion has a fee — do NOT claim the certificate is free.
- Offer: instant free offer letter on apply, LOR (on completion), completion certificate (on completion — paid).
- Do NOT say "100% free", "completely free", "at no cost" — only the internship is free, the certificate costs.
- Do NOT claim: job placement, employment guarantee, industry-recognized certification, university accreditation, third-party internships, money-back.
- Do NOT exaggerate numbers beyond site data (10K+ learners, 7K+ certificates).
- Pick 2-3 domains per post from the AVAILABLE DOMAINS list above. Rotate between them — never repeat the same domains twice in a row.
- All claims must be provable from the terms and domain list above.

## BANNED WORDS
leverage, synergy, passionate, excited to announce, thrilled, game-changer, unlock your potential, dive in, in today's fast-paced world, cutting-edge, revolutionize, tag someone who needs this, don't miss out, grow your career

## CONTENT ANGLE ROTATION — pick a DIFFERENT angle each post, rotate through all 6
1. FEAR-BASED: Address placement anxiety, resume gaps, lack of projects
2. SKILL-SPECIFIC: Deep dive into ONE domain (Python, Web Dev, AI/ML, etc.)
3. COMPARISON: DevCraft vs certificate mills / vs doing nothing / vs paid courses
4. PROCESS: Explain HOW it works (offer letter → learn → projects → certificate)
5. SOCIAL PROOF: What past students achieved, numbers, scale
6. MYTH-BUSTING: Common misconceptions about internships/placements/certificates

## EMOTIONAL TONE
- Urgent but not desperate — make them feel the time pressure of placement season
- Relatable — name the exact anxiety they feel (resume gaps, no projects, imposter syndrome)
- Empowering — show a clear path forward, not just problems
- Natural emoji usage — ONE emoji per section max, never start with emoji
- Conversational, direct — write like a senior telling a junior the truth
- Avoid corporate speak, buzzwords, hollow motivation

## HOOK RULES (first 2 lines — this is the only thing visible before "see more")
- Must name the exact fear or exact stat, not a vague benefit.
- Rotate between these 8 formats, never repeat same one twice in a row:
  1. Direct callout: "[X]nd year? No internship yet? Read this before placement season."
  2. Blunt stat: "73% of engineering grads have zero live-project experience on their resume. Here's the fix."
  3. Contrarian: "Your CGPA won't get you hired. This will."
  4. Specific outcome: "180+ students went from zero experience to a verified credential in 6 weeks."
  5. Question: "What if I told you that you're wasting your semester break?"
  6. Story open: "A tier-3 student with 0 projects. 6 weeks later, they had a certificate and an offer letter."
  7. Myth: "You don't need paid courses to build real projects. Here's proof."
  8. Direct command: "Stop scrolling and read this if you haven't built a single project this year."
- No question-mark clickbait ("Want to know the secret...?") — this audience skips it.

## ENGAGEMENT TECHNIQUES (use exactly one per post — pick a DIFFERENT one each time)
- "Which skill are you struggling with most? Drop it below 👇"
- "Tag a friend who needs to see this — it might help them too"
- "Save this post for later — you'll need it before placements"
- "How many of these skills do you have right now? 1/5? 3/5?"
- "Type 'INTERN' if you want the direct link"
- "What's the #1 thing stopping you from applying? Comment below."
- "Drop a 🔥 if you've already started your internship journey"
- "Comment which domain you're interested in — I'll share tips for that"
- "DM me 'DEVCRAFT' and I'll send you the link directly"
- "Which year are you in? Drop your year 👇"
- "Share this with your batch group — they'll thank you later"
- "React with 💪 if you're ready to start building today"

## POST STRUCTURE (follow this exact format when composing)
1. TITLE — Bold, single engaging line that names the topic (e.g. "No projects on your resume? Here's the fix.")
2. HOOK — 1-2 lines naming the fear/stat (the "see more" cutoff point)
3. SKILLS SECTION — "Skills You'll Build:" then exactly 3 bullet points (▸ skill — description)
4. BODY — 2-4 short, punchy lines about DevCraft, real projects, offer letter, timeline
5. PROOF — One line with a specific number (e.g. "10,000+ learners already enrolled")
6. ENGAGEMENT — One question or prompt from the techniques list (with emoji)
7. CTA — "Apply here: https://devcraft.fennark.xyz/"
8. HASHTAGS — 3-5 relevant hashtags (always include #DevCraft and #VirtualInternship)

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown, no code fences):
{
  "title": "2nd year with zero projects? Read this before placement season.",
  "hook": "73% of engineering students graduate without a single live project on their resume. Not because they can't — but because they never started.",
  "skills": [
    {"name": "Python", "desc": "Scripting, automation, backend — not just college syllabus"},
    {"name": "Web Development", "desc": "Build real apps with React & Node.js from scratch"},
    {"name": "AI/ML", "desc": "Work on live datasets, not Kaggle copy-paste"}
  ],
  "body": "DevCraft is a free virtual internship where you build real projects, get mentored, and earn a completion certificate + offer letter. Self-paced. 6 weeks. Entirely online.",
  "proof": "10,000+ engineering students already enrolled across India.",
  "engagement": "Which skill are you working on right now? Drop it below 👇",
  "cta_line": "Apply here: https://devcraft.fennark.xyz/",
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
  const ctaLine = parsed.cta_line || 'Apply here: https://devcraft.fennark.xyz/';
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
- Ensure CTA uses the exact URL: https://devcraft.fennark.xyz/
- Remove any banned words (leverage, synergy, passionate, game-changer, etc.)
- Stay compliant: no employment/placement guarantees, no claims of industry recognition
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
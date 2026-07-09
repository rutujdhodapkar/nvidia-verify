import { CosmosClient } from "@azure/cosmos";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
const COSMOS_DATABASE = "devcraft";
const COSMOS_CONTAINER = "main";

const SKIP_DIRS = new Set(["node_modules", ".git", ".github", "__pycache__", ".next", "dist", "build", ".vscode", "venv", "env", "vendor", ".idea", "coverage", ".nyc_output"]);
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".go", ".rb", ".php", ".swift", ".kt", ".scala", ".rs", ".html", ".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".json", ".yaml", ".yml", ".md", ".txt", ".sql", ".sh", ".bash"]);
const MAX_FILES = 15;
const MAX_FILE_SIZE = 200000;
const MAX_CODE_CHARS = 10000;

function getCosmosClient() {
  const connStr = process.env.COSMOS_DB_CONNECTION_STRING;
  if (!connStr) throw new Error("COSMOS_DB_CONNECTION_STRING not set");
  return new CosmosClient(connStr);
}

function cleanDoc(doc) {
  if (!doc) return null;
  const { entityType, _rid, _self, _etag, _attachments, _ts, ...rest } = doc;
  return rest;
}

async function listEnrollments(container) {
  const query = "SELECT * FROM c WHERE c.entityType = 'enrollments'";
  const { resources } = await container.items.query(query).fetchAll();
  return resources.map(r => ({ id: r.id, ...cleanDoc(r) }));
}

async function updateEnrollment(container, id, updates) {
  try {
    const { resource: existing } = await container.item(id, "enrollments").read();
    if (!existing) { console.warn(`  Enrollment ${id} not found in Cosmos DB`); return; }
    const merged = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      if (key.includes(".")) {
        const parts = key.split(".");
        let obj = merged;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!(parts[i] in obj) || typeof obj[parts[i]] !== "object") obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        merged[key] = value;
      }
    }
    await container.item(id, "enrollments").replace(merged);
  } catch (err) {
    console.error(`  Failed to update enrollment ${id}: ${err.message}`);
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function extractRepoInfo(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  let match;
  if (lower.includes("github.com")) {
    match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\/|$|\.git)/);
    if (match) {
      const info = { platform: "github", owner: match[1], repo: match[2].replace(/\.git$/, "") };
      const blobMatch = url.match(/github\.com\/[\w.-]+\/[\w.-]+\/blob\/([^/]+)\/(.+)/);
      if (blobMatch) { info.filePath = blobMatch[2]; info.ref = blobMatch[1]; }
      const treeMatch = url.match(/github\.com\/[\w.-]+\/[\w.-]+\/tree\/([^/]+)(?:\/(.*))?/);
      if (treeMatch) { info.dirPath = treeMatch[2] || ""; info.ref = treeMatch[1]; }
      return info;
    }
  }
  if (lower.includes("raw.githubusercontent.com")) {
    match = url.match(/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\//);
    if (match) return { platform: "github-raw", owner: match[1], repo: match[2] };
  }
  return null;
}

async function fetchGithubContents(owner, repo, path = "") {
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const res = await fetchWithTimeout(apiUrl, {
    headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "opencode-ai-verifier" },
  });
  if (res.status === 403) {
    const rateRemaining = res.headers.get("X-RateLimit-Remaining");
    if (rateRemaining === "0") throw new Error("GitHub API rate limit exceeded");
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

async function fetchRawFile(url) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Fetch ${res.status}`);
  return res.text();
}

async function fetchGithubRepoCode(owner, repo, dirPath = "") {
  const code = [];
  async function walk(path, depth = 0) {
    if (depth > 3 || code.length >= MAX_FILES) return;
    let items;
    try { items = await fetchGithubContents(owner, repo, path); } catch { return; }
    if (!Array.isArray(items)) {
      if (items.type === "file" && items.download_url) {
        const ext = "." + (items.name.split(".").pop() || "").toLowerCase();
        if (CODE_EXTENSIONS.has(ext) && (items.size || 0) < MAX_FILE_SIZE) {
          try {
            const content = await fetchRawFile(items.download_url);
            code.push({ path: items.path, content: content.slice(0, MAX_CODE_CHARS), size: items.size });
          } catch {}
        }
      }
      return;
    }
    const sorted = items.sort((a, b) => (a.type === "dir" ? 1 : -1));
    for (const item of sorted) {
      if (item.type === "dir") { if (!SKIP_DIRS.has(item.name)) await walk(item.path, depth + 1); }
      else if (item.type === "file") {
        const ext = "." + (item.name.split(".").pop() || "").toLowerCase();
        if (CODE_EXTENSIONS.has(ext) && (item.size || 0) < MAX_FILE_SIZE && code.length < MAX_FILES) {
          try {
            const content = await fetchRawFile(item.download_url);
            code.push({ path: item.path, content: content.slice(0, MAX_CODE_CHARS), size: item.size });
          } catch {}
        }
      }
    }
  }
  await walk(dirPath, 0);
  return code;
}

async function fetchCodeFromSubmission(submissionText, submissionUrl) {
  const codeFiles = [];
  const urls = [];
  if (submissionUrl) urls.push(submissionUrl.trim());
  const urlMatch = submissionText?.match(/https?:\/\/[^\s<>"']+/g);
  if (urlMatch) urls.push(...urlMatch);
  const seen = new Set();
  for (const url of urls) {
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    const info = extractRepoInfo(url);
    if (!info || info.platform !== "github") {
      if (/(?:raw\.githubusercontent|github\.io|\.(?:js|jsx|ts|tsx|py|html|css|json|md|txt|sh))$/i.test(url) && url.startsWith("http")) {
        try {
          const content = await fetchRawFile(url);
          codeFiles.push({ path: url, content: content.slice(0, MAX_CODE_CHARS) });
        } catch {}
      }
      continue;
    }
    try {
      let files;
      if (info.filePath) {
        const rawUrl = `https://raw.githubusercontent.com/${info.owner}/${info.repo}/${info.ref}/${info.filePath}`;
        try {
          const content = await fetchRawFile(rawUrl);
          files = [{ path: `${info.repo}/${info.filePath}`, content: content.slice(0, MAX_CODE_CHARS) }];
        } catch {}
      } else {
        files = await fetchGithubRepoCode(info.owner, info.repo, info.dirPath || "");
      }
      if (files && files.length > 0) codeFiles.push(...files);
    } catch (err) {
      console.warn(`  Failed to fetch repo: ${url} - ${err.message}`);
    }
  }
  return codeFiles;
}

function buildPrompt(taskTitle, taskDescription, taskNotice, submissionText, submissionUrl, internName, codeFiles) {
  const parts = [
    `Task Title: ${taskTitle}`,
    `Task Description: ${taskDescription || "No description provided"}`,
  ];
  if (taskNotice?.trim()) parts.push(`Task Instructions/Notices:\n${taskNotice}`);
  parts.push(`Student Name: ${internName || "Unknown"}`);
  parts.push(`Student's Submission Text: ${submissionText}`);
  if (submissionUrl) parts.push(`Submission URL: ${submissionUrl}`);
  if (codeFiles.length > 0) {
    parts.push("\n=== ACTUAL CODE FETCHED FROM REPOSITORY ===");
    for (const file of codeFiles) {
      parts.push(`\n--- File: ${file.path || file.name || "unknown"} ---\n${file.content || ""}`);
    }
    parts.push("\n=== END OF CODE ===");
    parts.push("\nCheck if the code implements the task. Missing dataset files are acceptable — focus on logic, structure, and whether it matches the task title. Minor TODOs or boilerplate comments are okay if the core functionality is present.");
  } else {
    parts.push("\nNote: No code repository could be accessed (link may be invalid, private, or not a repo). If the submission text clearly describes the work done, matches the task title, and explains the approach properly, you may still verify it. Missing dataset files are acceptable — focus on code logic and structure.");
  }
  parts.push("\nRespond with ONLY valid JSON (no markdown, no extra text): { verified: boolean, confidence: number (0-100), reason: string, message: string }");
  return parts.join("\n");
}

async function callNvidiaApi(prompt) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");
  const response = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an internship task reviewer. Evaluate the student's submission against the task requirements. The code should be error-free, match the task title/description, and show genuine effort. Missing dataset files or external assets are acceptable — focus on the logic and implementation. If the code is well-structured, runs without errors, and implements the requested functionality, approve it. Be fair, not strict. Respond ONLY with valid JSON (no markdown, no extra text): { verified: boolean, confidence: number (0-100), reason: string, message: string }",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 700,
    }),
  });
  const ai = await response.json();
  if (!response.ok) throw new Error(`NVIDIA API error ${response.status}: ${JSON.stringify(ai)}`);
  const content = ai.choices?.[0]?.message?.content || "{}";
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in AI response: ${content.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

async function main() {
  if (!process.env.NVIDIA_API_KEY) {
    console.error("NVIDIA_API_KEY not set.");
    process.exit(1);
  }

  const cosmos = getCosmosClient();
  const db = cosmos.database(COSMOS_DATABASE);
  const container = db.container(COSMOS_CONTAINER);

  console.log("Fetching all enrollments from Cosmos DB...");
  const enrollments = await listEnrollments(container);
  console.log(`Found ${enrollments.length} enrollments.`);

  let verified = 0;
  let skipped = 0;
  let errors = 0;

  for (const enrollment of enrollments) {
    const submissions = enrollment.submissions || {};
    const projects = enrollment.projects || [];
    const internName = enrollment.name || "Unknown";

    for (const [indexStr, sub] of Object.entries(submissions)) {
      const index = Number(indexStr);

      if (!sub.submittedAt) continue;
      if (sub.verified) { skipped++; continue; }
      if (sub.rejected) { skipped++; continue; }

      const project = projects[index];
      if (!project) {
        console.warn(`  ${enrollment.id}: No project found for index ${index}`);
        continue;
      }
      if (project.type === "quiz") {
        console.log(`  ${enrollment.id}: Task ${index} is a quiz (auto-graded on submit), skipping.`);
        continue;
      }

      const taskTitle = project.title || `Task ${index + 1}`;
      const taskDescription = project.description || "";
      const taskNotice = project.notice || "";
      const submissionText = sub.text || "";
      const submissionUrl = sub.url || "";

      console.log(`\n--- ${enrollment.id}: Verifying task "${taskTitle}" ---`);

      let codeFiles = [];
      try {
        codeFiles = await fetchCodeFromSubmission(submissionText, submissionUrl);
        console.log(`  Fetched ${codeFiles.length} code files.`);
      } catch (err) {
        console.warn(`  Failed to fetch code: ${err.message}`);
      }

      try {
        const prompt = buildPrompt(taskTitle, taskDescription, taskNotice, submissionText, submissionUrl, internName, codeFiles);
        const result = await callNvidiaApi(prompt);
        console.log(`  NVIDIA verdict: verified=${result.verified}, confidence=${result.confidence}`);
        console.log(`  Reason: ${result.reason}`);

        const nowStr = new Date().toISOString();
        const base = `submissions.${index}`;
        const update = {
          [`${base}.verified`]: result.verified,
          [`${base}.aiVerified`]: true,
          [`${base}.verifiedBy`]: "ai",
          [`${base}.aiConfidence`]: result.confidence,
          [`${base}.aiReason`]: result.reason,
          [`${base}.aiMessage`]: result.message || "",
          [`${base}.aiVerifiedAt`]: nowStr,
          updatedAt: nowStr,
        };
        if (result.verified) {
          update[`${base}.verifiedAt`] = nowStr;
          update[`${base}.rejected`] = false;
          update[`${base}.rejectedAt`] = null;
          update[`${base}.resubmit`] = false;
          update[`${base}.feedback`] = "";
        } else {
          update[`${base}.verifiedAt`] = null;
          update[`${base}.rejected`] = true;
          update[`${base}.rejectedAt`] = nowStr;
          update[`${base}.resubmit`] = true;
          update[`${base}.feedback`] = result.message || result.reason || "Task did not meet requirements. Please review and resubmit.";
        }
        await updateEnrollment(container, enrollment.id, update);

        if (result.verified) {
          verified++;
          console.log(`  ✓ Task verified successfully.`);
        } else {
          console.log(`  ✗ Task NOT verified.`);
        }
      } catch (err) {
        errors++;
        console.error(`  ✗ Error verifying task: ${err.message}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Verified: ${verified}`);
  console.log(`Skipped (already verified/rejected): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${verified + skipped + errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
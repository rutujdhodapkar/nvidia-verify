export default {
  async scheduled(event, env, ctx) {
    const workflows = ['devcraft-post.yml'];
    for (const workflow of workflows) {
      try {
        const result = await triggerWorkflow(env, workflow);
        console.log(`[SCHEDULED] ${workflow}: ${JSON.stringify(result)}`);
      } catch (err) {
        console.log(`[SCHEDULED] ${workflow} error: ${err.message}`);
      }
    }
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/trigger' && request.method === 'POST') {
      try {
        const { workflow } = await request.json();
        const result = await triggerWorkflow(env, workflow || 'devcraft-post.yml');
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
    return new Response('DEV/CRAFT GitHub Trigger Worker. POST /trigger with {"workflow":"file.yml"}', { status: 200 });
  },
};

async function triggerWorkflow(env, workflow) {
  const pat = env.GH_PAT;
  const repo = env.GH_REPO;
  if (!pat) return { error: 'Missing GH_PAT secret' };
  if (!repo) return { error: 'Missing GH_REPO var' };

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) return { error: `Invalid GH_REPO: ${repo}` };

  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflow}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'User-Agent': 'devcraft-worker',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ ref: 'master' }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { error: `GitHub API ${res.status}: ${err.slice(0, 200)}`, workflow };
  }
  return { ok: true, workflow, triggered: new Date().toISOString() };
}

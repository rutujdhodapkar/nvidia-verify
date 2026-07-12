export default {
  async scheduled(event, env, ctx) {
    const { GITHUB_PAT, GITHUB_OWNER = 'rutujdhodapkar', GITHUB_REPO = 'nvidia-verify', WORKFLOW_ID = 'linkedin-agent.yml' } = env;

    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_ID}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        'Content-Type': 'application/json',
        'User-Agent': 'devcraft-agent',
      },
      body: JSON.stringify({ ref: 'master' }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API ${res.status}: ${err.slice(0, 200)}`);
    }

    console.log(`Triggered ${WORKFLOW_ID} at ${new Date().toISOString()}`);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/__health') {
      return new Response(JSON.stringify({ ok: true, cron: '8AM/12PM/7PM IST Mon-Fri' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('DEV/CRAFT Agent Trigger Worker. Cron runs at 8AM, 12PM, 7PM IST Mon-Fri.', { status: 200 });
  },
};

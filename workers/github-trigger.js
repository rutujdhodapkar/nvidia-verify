export default {
  async scheduled(event, env, ctx) {
    const cron = event.cron;
    const { GITHUB_PAT, GITHUB_OWNER = 'rutujdhodapkar', GITHUB_REPO = 'nvidia-verify' } = env;

    let workflowId;
    if (cron === '30 4 * * *') {
      workflowId = 'email-campaign.yml';
    } else {
      workflowId = 'linkedin-agent.yml';
    }

    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflowId}/dispatches`, {
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

    console.log(`[${cron}] Triggered ${workflowId} at ${new Date().toISOString()}`);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/__health') {
      return new Response(JSON.stringify({ ok: true, crons: '8AM/12PM/7PM IST (linkedin) | 10AM IST (email)' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Cron trigger worker. LinkedIn agent: 8AM/12PM/7PM IST. Email campaign: 10AM IST.', { status: 200 });
  },
};

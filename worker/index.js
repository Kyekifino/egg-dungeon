// Cloudflare Worker — receives feedback from the game and opens a GitHub Issue.
// Deploy: cd worker && wrangler deploy
// Secret:  wrangler secret put GITHUB_TOKEN  (fine-grained token, issues:write on this repo)

const REPO = 'Kyekifino/egg-dungeon';
const GITHUB_API = 'https://api.github.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    if (!env.GITHUB_TOKEN) {
      console.error('GITHUB_TOKEN secret is not set');
      return json({ error: 'Server misconfigured' }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const { title, description, type, version } = body;

    if (!title?.trim()) return json({ error: 'Title is required' }, 400);
    if (!description?.trim()) return json({ error: 'Description is required' }, 400);

    const safeTitle = title.trim().slice(0, 120);
    const safeDesc  = description.trim().slice(0, 4000);

    const typeLabel = { bug: 'bug', suggestion: 'enhancement', other: 'feedback' }[type] ?? 'feedback';
    const labels = ['player-feedback', typeLabel];

    const issueBody = [
      `**Type:** ${type ?? 'feedback'}`,
      version ? `**Game version:** ${version}` : null,
      '',
      '---',
      '',
      safeDesc,
    ].filter(l => l !== null).join('\n');

    const resp = await fetch(`${GITHUB_API}/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'egg-dungeon-feedback-worker',
      },
      body: JSON.stringify({ title: safeTitle, body: issueBody, labels }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('GitHub API error:', resp.status, text);
      return json({ error: 'Failed to create issue' }, 502);
    }

    const issue = await resp.json();
    return json({ number: issue.number, url: issue.html_url }, 201);
  },
};

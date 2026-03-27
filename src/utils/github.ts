interface ActionRef {
  owner: string;
  repo: string;
  ref: string;
}

export function parseActionRef(usesLine: string): ActionRef | null {
  // handles "uses: actions/checkout@v4", "- uses: actions/cache/restore@v4", or bare ref
  let raw = usesLine.trim();
  // strip "- uses:" or "uses:" prefix if present
  const prefixMatch = raw.match(/^(?:-\s+)?uses:\s*(.*)/);
  if (prefixMatch) raw = prefixMatch[1].trim();
  // skip local actions and docker refs
  if (raw.startsWith('.') || raw.startsWith('docker://')) return null;
  // split on first @ to separate action path from ref
  const atIdx = raw.indexOf('@');
  if (atIdx === -1) return null;
  const actionPath = raw.slice(0, atIdx);
  const ref = raw.slice(atIdx + 1).split(/\s/)[0];
  // owner/repo or owner/repo/subpath - extract only owner/repo for API calls
  const slashIdx = actionPath.indexOf('/');
  if (slashIdx === -1) return null;
  const owner = actionPath.slice(0, slashIdx);
  const rest = actionPath.slice(slashIdx + 1);
  const secondSlash = rest.indexOf('/');
  const repo = secondSlash === -1 ? rest : rest.slice(0, secondSlash);
  return { owner, repo, ref };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Resolve a GitHub Action tag to its full commit SHA.
 * Handles annotated tags by dereferencing through the tag object.
 * Set GITHUB_TOKEN for 5000 req/hr instead of 60.
 */
export async function resolveActionSHA(
  owner: string,
  repo: string,
  tag: string,
): Promise<string | null> {
  try {
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/tags/${tag}`,
      { headers: githubHeaders() },
    );

    if (refRes.status === 403) {
      const remaining = refRes.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        console.error('GitHub API rate limit exceeded. Set GITHUB_TOKEN env var for 5000 req/hr.');
      }
      return null;
    }
    if (!refRes.ok) return null;

    const refData = (await refRes.json()) as { object: { type: string; sha: string } };

    if (refData.object.type === 'commit') {
      return refData.object.sha;
    }

    if (refData.object.type === 'tag') {
      const tagRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/tags/${refData.object.sha}`,
        { headers: githubHeaders() },
      );
      if (!tagRes.ok) return null;

      const tagData = (await tagRes.json()) as { object: { sha: string } };
      return tagData.object.sha;
    }

    return refData.object.sha;
  } catch {
    return null;
  }
}

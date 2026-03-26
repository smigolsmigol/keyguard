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
  // owner/repo or owner/repo/subpath
  const slashIdx = actionPath.indexOf('/');
  if (slashIdx === -1) return null;
  const owner = actionPath.slice(0, slashIdx);
  const repo = actionPath.slice(slashIdx + 1);
  return { owner, repo, ref };
}

/**
 * Resolve a GitHub Action tag to its full commit SHA.
 * Handles annotated tags by dereferencing through the tag object.
 */
export async function resolveActionSHA(
  owner: string,
  repo: string,
  tag: string,
): Promise<string | null> {
  try {
    // try as a git ref first (works for lightweight tags and branches)
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/tags/${tag}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } },
    );

    if (!refRes.ok) return null;

    const refData = (await refRes.json()) as { object: { type: string; sha: string } };

    // lightweight tag points directly at a commit
    if (refData.object.type === 'commit') {
      return refData.object.sha;
    }

    // annotated tag: dereference to get the underlying commit
    if (refData.object.type === 'tag') {
      const tagRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/tags/${refData.object.sha}`,
        { headers: { Accept: 'application/vnd.github.v3+json' } },
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

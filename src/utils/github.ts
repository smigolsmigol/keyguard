interface ActionRef {
  owner: string;
  repo: string;
  ref: string;
}

export function parseActionRef(usesLine: string): ActionRef | null {
  // handles "uses: actions/checkout@v4" or just "actions/checkout@v4"
  const raw = usesLine.includes(':') ? usesLine.split(':').slice(1).join(':').trim() : usesLine.trim();
  const match = raw.match(/^([^/]+)\/([^@]+)@(\S+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], ref: match[3] };
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

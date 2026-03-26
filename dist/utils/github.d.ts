interface ActionRef {
    owner: string;
    repo: string;
    ref: string;
}
export declare function parseActionRef(usesLine: string): ActionRef | null;
/**
 * Resolve a GitHub Action tag to its full commit SHA.
 * Handles annotated tags by dereferencing through the tag object.
 */
export declare function resolveActionSHA(owner: string, repo: string, tag: string): Promise<string | null>;
export {};

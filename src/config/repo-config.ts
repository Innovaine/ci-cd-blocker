export interface RepoConfig {
  owner: string;
  repo: string;
  stagingUrl?: string;
  testCommand?: string;
  notifyOn?: 'always' | 'failure-only';
}

/**
 * Load config for a repo.
 * ASSUMPTION: For MVP, return a default config. After first customer, read from GitHub .innovaine.yaml.
 */
export function loadRepoConfig(owner: string, repo: string): RepoConfig | null {
  // ASSUMPTION: Default config is sufficient for MVP. Real repos will need their own .innovaine.yaml.
  console.log(`[repo-config] Loading config for ${owner}/${repo}`);

  return {
    owner,
    repo,
    stagingUrl: `http://staging-${repo}.local:3000`,
    notifyOn: 'failure-only',
  };
}
/**
 * Loads per-repo configuration for CI/CD blocking rules.
 * ASSUMPTION: config is stored as a JSON file in the GitHub repo root (.github/ci-cd-config.json)
 * or defaults to sensible defaults if missing.
 */

export interface RepoConfig {
  stagingUrl: string;
  testPaths: string[];
  notifyChannel?: string;
  blockOnTestFailure: boolean;
  allowManualOverride: boolean;
}

const DEFAULT_CONFIG: RepoConfig = {
  stagingUrl: 'http://localhost:3001',
  testPaths: ['./test', './tests', './integration-tests'],
  blockOnTestFailure: true,
  allowManualOverride: true,
};

export async function loadRepoConfig(owner: string, repo: string): Promise<RepoConfig> {
  // ASSUMPTION: config is sourced from repo's .github/ci-cd-config.json
  // For MVP, we return defaults. In future, fetch from GitHub API or clone the repo.
  console.log(`[Config] Loading config for ${owner}/${repo}`);
  return DEFAULT_CONFIG;
}
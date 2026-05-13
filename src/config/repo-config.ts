export interface RepoConfig {
  owner: string;
  repo: string;
  stagingUrl: string;
  testTimeoutMs: number;
  integrationTestScript: string;
}

export function loadRepoConfig(owner: string, repo: string): RepoConfig {
  // ASSUMPTION: For MVP, derive staging URL from environment + repo name.
  // Real version will read from a config file, database, or repository-level config.
  const stagingBaseUrl = process.env.STAGING_BASE_URL || 'http://staging.example.com';

  return {
    owner,
    repo,
    stagingUrl: `${stagingBaseUrl}/${owner}/${repo}`,
    testTimeoutMs: 60000, // 1 minute
    integrationTestScript: 'npm run test:integration',
  };
}
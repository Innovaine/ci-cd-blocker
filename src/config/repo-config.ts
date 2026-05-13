export interface RepoConfig {
  owner: string;
  repo: string;
  stagingUrl: string;
  testTimeoutMs: number;
  integrationTestScript: string;
}

export function loadRepoConfig(owner: string, repo: string): RepoConfig {
  // ASSUMPTION: For MVP, derive staging URL from repo name. Real version would read from a config file or database.
  const stagingUrl = process.env.STAGING_BASE_URL || 'http://staging.example.com';

  return {
    owner,
    repo,
    stagingUrl: `${stagingUrl}/${owner}/${repo}`,
    testTimeoutMs: 60000, // 1 minute
    integrationTestScript: 'npm run test:integration',
  };
}
export interface RepoConfig {
  owner: string;
  repo: string;
  mainBranch: string;
  stagingUrl: string;
  slackChannel: string;
  autoMergeOnPass?: boolean;
}

// ASSUMPTION: In MVP, repo config is hardcoded per repo.
// Future: fetch from .innovaine/config.json in the target repo
// or from a centralized config service.
// For now, environment variables override defaults, keeping bootstrap simple.

export async function loadRepoConfig(owner: string, repo: string): Promise<RepoConfig> {
  const config: RepoConfig = {
    owner,
    repo,
    mainBranch: process.env.MAIN_BRANCH || 'main',
    stagingUrl: process.env.STAGING_URL || 'http://localhost:3001',
    slackChannel: process.env.SLACK_CHANNEL || '#deployments',
    autoMergeOnPass: false,
  };

  console.log(`[Config] Loaded config for ${owner}/${repo}: staging=${config.stagingUrl}`);
  return config;
}
export interface RepoConfig {
  owner: string;
  repo: string;
  mainBranch: string;
  stagingUrl: string;
  slackChannel: string;
  autoMergeOnPass?: boolean; // Future: not in MVP
}

// ASSUMPTION: Repo config is stored in the GitHub repo itself at .innovaine/config.json
// This keeps config close to the code and versioned with the repo
// Future: centralized config management

export async function loadRepoConfig(owner: string, repo: string): Promise<RepoConfig> {
  // ASSUMPTION: In MVP, we use a static config per repo
  // Production: fetch from GitHub raw content API
  // For now, return a hardcoded config to keep the build moving

  // This is a strawman config shape; real config will come from .innovaine/config.json in the target repo
  return {
    owner,
    repo,
    mainBranch: 'main',
    stagingUrl: process.env.STAGING_URL || 'http://localhost:3001',
    slackChannel: process.env.SLACK_CHANNEL || '#deployments',
    autoMergeOnPass: false,
  };
}
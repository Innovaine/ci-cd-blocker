export interface RepoConfig {
  owner: string;
  repo: string;
  stagingUrl: string;
  testCommand: string;
  slackChannel: string;
  overrideAllowed: boolean;
}

export function loadRepoConfig(owner: string, repo: string): RepoConfig {
  // ASSUMPTION: In MVP, no config file. Throw so caller falls back to defaults.
  throw new Error(`No config found for ${owner}/${repo}`);
}
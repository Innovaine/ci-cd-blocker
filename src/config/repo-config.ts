/**
 * repo-config.ts
 * Loads deployment configuration for a repository.
 * 
 * ASSUMPTION: Config is read from a repo-root file: `.deploy-check.json`
 * on the branch being tested. For MVP, we read from hardcoded in-memory defaults.
 * Next cycle: fetch from GitHub content API using the PR's base branch.
 */

export interface RepoConfig {
  owner: string;
  repo: string;
  enabled: boolean;
  integrationTests?: string[];
  stagingEnvironmentUrl?: string;
  slackChannel?: string;
  allowManualOverride: boolean;
  notifyOnPass: boolean;
}

// In-memory config defaults for known repos.
const configCache = new Map<string, RepoConfig>();

/**
 * loadRepoConfig
 * Retrieves configuration for a repo.
 * 
 * ASSUMPTION: For MVP, returns a default config if the repo is registered.
 * Production: fetch from .deploy-check.json in the repo via GitHub API.
 */
export async function loadRepoConfig(
  owner: string,
  repo: string
): Promise<RepoConfig | null> {
  const cacheKey = `${owner}/${repo}`;

  // Return cached config if available.
  if (configCache.has(cacheKey)) {
    console.log(`[config] Returning cached config for ${cacheKey}`);
    return configCache.get(cacheKey)!;
  }

  // ASSUMPTION: For MVP, we have a whitelist of enabled repos.
  // In production, this check happens after fetching from the repo.
  const enabledRepos = process.env.ENABLED_REPOS?.split(',') || [];
  const isEnabled = enabledRepos.includes(cacheKey);

  if (!isEnabled) {
    console.log(
      `[config] Repo ${cacheKey} not in enabled list. Returning null.`
    );
    return null;
  }

  // Build default config for this repo.
  const config: RepoConfig = {
    owner,
    repo,
    enabled: true,
    integrationTests: [
      'npm run test:integration',
      'npm run test:e2e',
    ],
    stagingEnvironmentUrl: process.env.STAGING_URL || 'http://localhost:3001',
    slackChannel: process.env.SLACK_CHANNEL || '#deployments',
    allowManualOverride: true,
    notifyOnPass: false,
  };

  // Cache and return.
  configCache.set(cacheKey, config);
  console.log(`[config] Loaded config for ${cacheKey}`, {
    testsConfigured: config.integrationTests?.length,
    stagingUrl: config.stagingEnvironmentUrl,
  });

  return config;
}

/**
 * clearConfigCache
 * Clears the in-memory config cache (useful for testing).
 */
export function clearConfigCache(): void {
  configCache.clear();
  console.log(`[config] Cleared config cache`);
}
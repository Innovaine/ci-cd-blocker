import { logger } from '../utils/logger';

// ASSUMPTION: repo configs are loaded from environment variables in the format:
// REPO_CONFIG_OWNER_REPO=stagingUrl:https://staging.example.com,testTimeoutMs:120000
// This is a placeholder; in production, this would come from a database or config service

export interface RepoConfig {
  owner: string;
  repo: string;
  stagingUrl: string;
  testTimeoutMs?: number;
}

const configCache: Map<string, RepoConfig> = new Map();

export function getRepoConfig(owner: string, repo: string): RepoConfig {
  const key = `${owner}/${repo}`;

  if (configCache.has(key)) {
    return configCache.get(key)!;
  }

  // Try to load from environment
  const envKey = `REPO_CONFIG_${owner.toUpperCase()}_${repo.toUpperCase()}`;
  const envValue = process.env[envKey];

  let config: RepoConfig = { owner, repo, stagingUrl: '', testTimeoutMs: 60000 };

  if (envValue) {
    // Parse comma-separated key:value pairs
    // Format: stagingUrl:https://staging.example.com,testTimeoutMs:120000
    const pairs = envValue.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split(':');
      if (key === 'stagingUrl') {
        config.stagingUrl = value;
      } else if (key === 'testTimeoutMs') {
        config.testTimeoutMs = parseInt(value, 10);
      }
    }
  }

  // Fallback: try generic staging URL env var
  if (!config.stagingUrl) {
    config.stagingUrl = process.env.DEFAULT_STAGING_URL || '';
  }

  configCache.set(key, config);
  logger.info(`Loaded config for ${key}: stagingUrl=${config.stagingUrl}`);

  return config;
}

export function setRepoConfig(config: RepoConfig): void {
  const key = `${config.owner}/${config.repo}`;
  configCache.set(key, config);
  logger.info(`Updated config for ${key}`);
}
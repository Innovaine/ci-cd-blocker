import axios from 'axios';
import { logger } from '../utils/logger';
import { RepoConfig } from '../config/repo-config';

// ASSUMPTION: Staging environment exposes a POST /api/test/run endpoint
// ASSUMPTION: Payload is { owner, repo, prNumber, headSha, baseRef }
// ASSUMPTION: Response is { passed: boolean, failures: Array<{name: string, error: string}> }
// ASSUMPTION: Staging may be slow; timeout is set per repo config (default 60s)
// ASSUMPTION: If staging is unreachable, we fail the PR (safe default)

export interface TestResult {
  passed: boolean;
  failures: Array<{ name: string; error: string }>;
}

export interface TestContext {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  baseRef: string;
}

export async function orchestrateTests(config: RepoConfig, context: TestContext): Promise<TestResult> {
  const { stagingUrl, testTimeoutMs = 60000 } = config;
  const { owner, repo, prNumber, headSha, baseRef } = context;

  if (!stagingUrl) {
    logger.error(`No staging URL configured for ${owner}/${repo}`);
    return {
      passed: false,
      failures: [
        {
          name: 'Configuration Error',
          error: 'Staging URL not configured for this repository',
        },
      ],
    };
  }

  const testEndpoint = `${stagingUrl}/api/test/run`;

  logger.info(`Orchestrating tests for ${owner}/${repo}#${prNumber} at ${testEndpoint}`);

  try {
    const response = await axios.post(
      testEndpoint,
      {
        owner,
        repo,
        prNumber,
        headSha,
        baseRef,
      },
      {
        timeout: testTimeoutMs,
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const result: TestResult = response.data;

    if (result.passed) {
      logger.info(`Tests passed for ${owner}/${repo}#${prNumber}`);
    } else {
      logger.warn(
        `Tests failed for ${owner}/${repo}#${prNumber}: ${result.failures.length} failure(s)`
      );
    }

    return result;
  } catch (error) {
    logger.error(
      `Test orchestration failed for ${owner}/${repo}#${prNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    // Safe default: if staging is unreachable or times out, fail the PR
    return {
      passed: false,
      failures: [
        {
          name: 'Test Orchestration Failed',
          error:
            error instanceof Error ? error.message : 'Unknown error during test orchestration',
        },
      ],
    };
  }
}
import { RepoConfig } from '../config/repo-config';
import { runIntegrationTests } from './runner';

export interface TestContext {
  prNumber: number;
  headSha: string;
  headRef: string;
  baseSha: string;
  baseRef: string;
  owner: string;
  repo: string;
}

export interface TestResult {
  passed: boolean;
  reason: string;
  duration: number;
}

/**
 * Orchestrate integration tests for a PR.
 * 1. Validate test context
 * 2. Run integration tests against staging
 * 3. Return pass/fail result
 *
 * ASSUMPTION: Tests are run synchronously (blocking). Timeout guard comes after first customer.
 */
export async function orchestrateTests(config: RepoConfig, context: TestContext): Promise<TestResult> {
  console.log(`[orchestrator] Starting tests for ${context.owner}/${context.repo}#${context.prNumber}`);

  const startTime = Date.now();

  try {
    // ASSUMPTION: staging URL is in config or hardcoded. For MVP, assume it exists.
    const stagingUrl = config.stagingUrl || `http://staging-${context.repo}.local:3000`;

    console.log(`[orchestrator] Running tests against ${stagingUrl}`);

    // Run the actual test suite
    const testsPassed = await runIntegrationTests(stagingUrl, context);

    const duration = Date.now() - startTime;

    if (testsPassed) {
      console.log(`[orchestrator] ✓ Tests passed in ${duration}ms`);
      return {
        passed: true,
        reason: 'all-tests-passed',
        duration,
      };
    } else {
      console.log(`[orchestrator] ✗ Tests failed in ${duration}ms`);
      return {
        passed: false,
        reason: 'integration-tests-failed',
        duration,
      };
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[orchestrator] Error during test orchestration:`, err);
    return {
      passed: false,
      reason: String(err),
      duration,
    };
  }
}
import { RepoConfig } from '../config/repo-config';
import { runTests } from './runner';

export interface TestContext {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
}

export interface TestResult {
  success: boolean;
  reason: string;
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
}

/**
 * Orchestrate the full integration test flow for a PR.
 * ASSUMPTION: Tests are synchronous. Real impl will add timeout guard, retries.
 */
export async function orchestrateTests(
  config: RepoConfig,
  context: TestContext
): Promise<TestResult> {
  console.log(
    `[orchestrator] Starting for ${context.owner}/${context.repo}#${context.prNumber}`
  );

  try {
    // Run integration tests against staging
    const result = await runTests(config, context);

    if (result.success) {
      console.log(
        `[orchestrator] ✓ Tests passed for ${context.owner}/${context.repo}#${context.prNumber}`
      );
      return {
        success: true,
        reason: 'All integration tests passed',
        testsRun: result.testsRun,
        testsPassed: result.testsPassed,
      };
    } else {
      console.log(
        `[orchestrator] ✗ Tests failed for ${context.owner}/${context.repo}#${context.prNumber}`
      );
      return {
        success: false,
        reason: `Tests failed: ${result.reason}`,
        testsRun: result.testsRun,
        testsFailed: result.testsFailed,
      };
    }
  } catch (err) {
    console.error(`[orchestrator] Error:`, err);
    return {
      success: false,
      reason: `Orchestration error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}
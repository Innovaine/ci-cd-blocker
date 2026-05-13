import { runTests } from './runner';

export interface TestContext {
  prNumber: number;
  commitSha: string;
  owner: string;
  repo: string;
  authorLogin?: string;
}

export interface TestResult {
  passed: boolean;
  failureReason?: string;
  details?: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Orchestrates the full test workflow:
 * 1. Load repo config (staging URL, test paths)
 * 2. Check out the PR commit
 * 3. Run integration tests
 * 4. Return pass/fail decision
 */
export async function orchestrateTests(
  config: any,
  context: TestContext
): Promise<TestResult> {
  const { stagingUrl, testPaths } = config;
  const { prNumber, commitSha, owner, repo, authorLogin } = context;

  if (!stagingUrl) {
    return {
      passed: false,
      failureReason: 'No staging URL configured for this repo',
    };
  }

  if (!testPaths || testPaths.length === 0) {
    return {
      passed: true, // If no tests defined, assume pass
      failureReason: undefined,
    };
  }

  console.log(
    `[Orchestrator] Running tests for ${owner}/${repo} PR #${prNumber}`
  );
  console.log(`  Staging URL: ${stagingUrl}`);
  console.log(`  Test paths: ${testPaths.join(', ')}`);

  // Run the test suite
  try {
    const result = await runTests({
      stagingUrl,
      testPaths,
      commitSha,
      timeout: 60000, // 60 seconds
    });

    if (result.passed) {
      return {
        passed: true,
        details: result.details,
      };
    } else {
      return {
        passed: false,
        failureReason: result.error || 'Tests failed',
        details: result.details,
      };
    }
  } catch (err) {
    return {
      passed: false,
      failureReason: `Test execution error: ${String(err)}`,
    };
  }
}
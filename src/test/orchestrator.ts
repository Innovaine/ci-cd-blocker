import { runIntegrationTests } from './runner';

export interface TestContext {
  prNumber: number;
  commitSha: string;
  branchName: string;
}

export interface TestResult {
  passed: boolean;
  failureReason?: string;
  durationMs: number;
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
}

// ASSUMPTION: Integration tests are run against a live staging endpoint
// The staging environment is assumed to be healthy and reachable
// In week 3, add health checks and retry logic
export async function orchestrateTests(config: any, context: TestContext): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`[Orchestrator] Running tests for PR #${context.prNumber} (${context.commitSha.substring(0, 7)})`);
    console.log(`[Orchestrator] Staging URL: ${config.stagingUrl}`);

    // Run the actual integration test suite
    const result = await runIntegrationTests(config.stagingUrl);

    const durationMs = Date.now() - startTime;

    if (result.passed) {
      console.log(`[Orchestrator] ✅ All tests passed in ${durationMs}ms`);
      return {
        passed: true,
        durationMs,
        testsRun: result.testsRun,
        testsPassed: result.testsPassed,
      };
    } else {
      console.log(`[Orchestrator] ❌ Tests failed: ${result.failureReason}`);
      return {
        passed: false,
        failureReason: result.failureReason,
        durationMs,
        testsRun: result.testsRun,
        testsPassed: result.testsPassed,
        testsFailed: result.testsFailed,
      };
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Orchestrator] Error: ${errorMsg}`);
    return {
      passed: false,
      failureReason: `Test orchestration error: ${errorMsg}`,
      durationMs,
    };
  }
}
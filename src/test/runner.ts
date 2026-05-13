import { orchestrateTests, TestContext, TestResult } from './orchestrator';
import { RepoConfig } from '../config/repo-config';

export async function runTests(config: RepoConfig, context: TestContext): Promise<TestResult> {
  console.log(`[runner] Starting test suite for PR ${context.prNumber}`);

  try {
    const result = await orchestrateTests(config, context);

    console.log(`[runner] Test result: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`[runner]   Passed: ${result.testsPassed || 0}`);
    console.log(`[runner]   Failed: ${result.testsFailed || 0}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`[runner]   Errors: ${result.errors.join('; ')}`);
    }

    return result;
  } catch (e) {
    console.error(`[runner] Orchestration error:`, e);
    return {
      passed: false,
      errors: [String(e)],
    };
  }
}
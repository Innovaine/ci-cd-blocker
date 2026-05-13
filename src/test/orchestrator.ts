/**
 * Orchestrates test execution: reads config, runs integration tests,
 * returns structured result.
 */

import { runTests } from './runner.js';
import { RepoConfig } from '../config/repo-config.js';

export interface TestResult {
  passed: boolean;
  error?: string;
  details?: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

export async function orchestrateTests(config: RepoConfig): Promise<TestResult> {
  console.log('[Orchestrator] Starting test execution');
  console.log('[Orchestrator] Test paths:', config.testPaths);
  console.log('[Orchestrator] Staging URL:', config.stagingUrl);

  try {
    const result = await runTests();
    console.log('[Orchestrator] Test execution completed:', result);
    return result;
  } catch (err) {
    console.error('[Orchestrator] Test execution failed:', err);
    return {
      passed: false,
      error: `Test execution failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
}
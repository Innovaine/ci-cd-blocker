// ASSUMPTION: Test files are Node/JavaScript tests (Jest, Mocha, or simple Node scripts)
// ASSUMPTION: Tests exit with code 0 on pass, non-zero on fail
// ASSUMPTION: Staging URL is reachable and health-checked before tests run

import { execSync } from 'child_process';

export interface TestRunOptions {
  stagingUrl: string;
  testPaths: string[];
  timeout: number;
}

export interface TestRunResult {
  passed: boolean;
  failures?: Array<{ test: string; error: string }>;
}

export async function runTests(options: TestRunOptions): Promise<TestRunResult> {
  const { stagingUrl, testPaths, timeout } = options;

  console.log(`Running ${testPaths.length} test suite(s) against ${stagingUrl}`);

  // Set env var so tests can find staging
  process.env.STAGING_URL = stagingUrl;

  const failures: Array<{ test: string; error: string }> = [];

  for (const testPath of testPaths) {
    try {
      console.log(`  → Running ${testPath}`);
      // ASSUMPTION: Test file is executable or can be run via node
      execSync(`node ${testPath}`, {
        stdio: 'inherit',
        timeout,
      });
      console.log(`    ✓ ${testPath} passed`);
    } catch (error) {
      console.error(`    ✗ ${testPath} failed`);
      failures.push({
        test: testPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures: failures.length > 0 ? failures : undefined,
  };
}
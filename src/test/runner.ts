/**
 * Runs integration tests against staging environment.
 * ASSUMPTION: Tests are invoked via `npm test` command.
 * MVP stub; real test suite to follow.
 */

import { spawn } from 'child_process';

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

export async function runTests(): Promise<TestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    console.log('[Runner] Starting test process');

    // ASSUMPTION: For MVP, we just run `npm test` and check exit code.
    // This is a stub. Real integration tests (HTTP calls to staging, assertions) come later.
    const proc = spawn('npm', ['test'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log('[Runner] stdout:', chunk.trim());
    });

    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log('[Runner] stderr:', chunk.trim());
    });

    proc.on('exit', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        resolve({
          passed: true,
          details: {
            totalTests: 1,
            passed: 1,
            failed: 0,
            duration,
          },
        });
      } else {
        resolve({
          passed: false,
          error: `Test suite exited with code ${code}`,
          details: {
            totalTests: 1,
            passed: 0,
            failed: 1,
            duration,
          },
        });
      }
    });
  });
}
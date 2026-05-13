import { spawn } from 'child_process';

export interface RunTestsInput {
  stagingUrl: string;
  testPaths: string[];
  commitSha?: string;
  timeout?: number;
}

export interface RunTestsOutput {
  passed: boolean;
  error?: string;
  details?: {
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Executes integration tests against a staging environment.
 * Returns pass/fail status and details.
 * ASSUMPTION: test suite is invoked via `npm test` with env var STAGING_URL.
 */
export async function runTests(input: RunTestsInput): Promise<RunTestsOutput> {
  const { stagingUrl, testPaths, timeout = 60000 } = input;

  const startTime = Date.now();

  return new Promise((resolve) => {
    const env = { ...process.env, STAGING_URL: stagingUrl };

    // Spawn the test runner (npm test) with environment variables
    const proc = spawn('npm', ['test', '--', ...testPaths], {
      env,
      stdio: 'pipe',
      timeout,
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('[Test Output]', data.toString());
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[Test Error]', data.toString());
      });
    }

    proc.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        passed: false,
        error: `Failed to spawn test process: ${err.message}`,
        details: {
          totalTests: 0,
          passed: 0,
          failed: 1,
          duration,
        },
      });
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
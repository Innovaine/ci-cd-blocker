export interface TestContext {
  prNumber: number;
  owner: string;
  repo: string;
  stagingUrl: string;
}

export interface TestResult {
  passed: boolean;
  error?: string;
}

/**
 * Orchestrate integration tests against the staging environment.
 * 
 * ASSUMPTION: For MVP, this makes a simple HTTP GET request to the staging URL
 * and checks that it returns 2xx. In the next iteration, this will:
 *   1. Parse repo config for specific endpoints to test
 *   2. Run a series of HTTP assertions
 *   3. Return detailed results per endpoint
 */
export async function orchestrateTests(context: TestContext): Promise<TestResult> {
  const { owner, repo, prNumber, stagingUrl } = context;

  console.log(
    `[Integration Test] Running for ${owner}/${repo}#${prNumber} against ${stagingUrl}`
  );

  try {
    // Simple health check: GET stagingUrl and expect 2xx.
    // Use AbortController for timeout (standard Fetch API way).
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(stagingUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutHandle);

    if (response.ok) {
      console.log(
        `[Integration Test] PASSED: ${stagingUrl} returned ${response.status}`
      );
      return { passed: true };
    } else {
      const error = `Staging server returned ${response.status}`;
      console.log(`[Integration Test] FAILED: ${error}`);
      return { passed: false, error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[Integration Test] ERROR: ${errorMessage}`);
    return { passed: false, error: `Integration test execution failed: ${errorMessage}` };
  }
}
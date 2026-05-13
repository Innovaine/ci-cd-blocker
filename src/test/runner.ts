import axios from 'axios';

export interface TestRunRequest {
  repoOwner: string;
  repoName: string;
  headSha: string;
  stagingUrl: string;
}

export interface TestRunResult {
  success: boolean;
  failureReason?: string;
  duration?: number;
}

export async function runIntegrationTests(req: TestRunRequest): Promise<TestRunResult> {
  // ASSUMPTION: staging environment exposes a /health endpoint and a /test endpoint
  // /health returns { status: 'ok' } if staging is ready
  // /test runs integration suite and returns { success: boolean, failureReason?: string, duration: number }
  // This is a happy-path skeleton; real tests depend on the staging environment shape

  const startTime = Date.now();

  try {
    // Check staging health
    console.log(`[Runner] Checking staging health at ${req.stagingUrl}`);
    const healthCheck = await axios.get(`${req.stagingUrl}/health`, { timeout: 5000 });
    if (healthCheck.status !== 200) {
      return {
        success: false,
        failureReason: 'Staging environment not healthy',
        duration: Date.now() - startTime,
      };
    }

    // Run tests
    console.log(`[Runner] Running integration tests against ${req.stagingUrl}`);
    const testResponse = await axios.post(`${req.stagingUrl}/test`, {
      headSha: req.headSha,
      repo: `${req.repoOwner}/${req.repoName}`,
      timeout: 30000,
    });

    const duration = Date.now() - startTime;

    if (testResponse.status === 200 && testResponse.data.success) {
      console.log(`[Runner] Tests passed in ${duration}ms`);
      return { success: true, duration };
    } else {
      console.log(`[Runner] Tests failed: ${testResponse.data.failureReason}`);
      return {
        success: false,
        failureReason: testResponse.data.failureReason || 'Tests failed',
        duration,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Runner] Integration test run error:`, error);
    return {
      success: false,
      failureReason: `Test runner error: ${String(error)}`,
      duration,
    };
  }
}
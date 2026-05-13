import axios from 'axios';

export interface IntegrationTestResult {
  passed: boolean;
  failureReason?: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
}

// ASSUMPTION: Staging environment exposes /health and /api/test endpoints
// /health returns { status: 'ok' }
// /api/test runs a suite of smoke tests and returns { passed: boolean, failures?: string[] }
// In production, this would invoke actual test framework (Jest, Mocha, etc.)
export async function runIntegrationTests(stagingUrl: string): Promise<IntegrationTestResult> {
  const testResults: IntegrationTestResult = {
    passed: false,
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
  };

  try {
    // Step 1: Health check
    console.log(`[Runner] Health check: ${stagingUrl}/health`);
    const healthResponse = await axios.get(`${stagingUrl}/health`, { timeout: 5000 });

    if (healthResponse.status !== 200) {
      testResults.failureReason = `Staging health check returned ${healthResponse.status}`;
      return testResults;
    }

    console.log(`[Runner] ✅ Staging health check passed`);

    // Step 2: Run integration tests
    console.log(`[Runner] Running tests: ${stagingUrl}/api/test`);
    const testResponse = await axios.post(`${stagingUrl}/api/test`, {}, { timeout: 30000 });

    const { passed, failures, testsRun = 1, testsPassed = 0, testsFailed = 0 } = testResponse.data;

    testResults.testsRun = testsRun;
    testResults.testsPassed = testsPassed;
    testResults.testsFailed = testsFailed;

    if (!passed) {
      testResults.passed = false;
      testResults.failureReason = failures ? failures.join('; ') : 'Tests failed without details';
      console.log(`[Runner] ❌ Tests failed: ${testResults.failureReason}`);
      return testResults;
    }

    testResults.passed = true;
    console.log(`[Runner] ✅ All tests passed (${testsPassed}/${testsRun})`);
    return testResults;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        testResults.failureReason = `Cannot reach staging environment at ${stagingUrl}`;
      } else if (error.response?.status === 404) {
        testResults.failureReason = `Test endpoint not found at ${stagingUrl}/api/test`;
      } else {
        testResults.failureReason = `Staging request failed: ${error.message}`;
      }
    } else {
      testResults.failureReason = `Test runner error: ${error instanceof Error ? error.message : String(error)}`;
    }

    console.error(`[Runner] Error: ${testResults.failureReason}`);
    return testResults;
  }
}
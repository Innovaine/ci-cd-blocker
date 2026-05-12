import axios, { AxiosError } from 'axios';
import { logger } from '../logger';

// ASSUMPTION: Staging environment exposes a `/test` endpoint that runs tests and returns JSON
// ASSUMPTION: Test result format: { success: boolean; duration: number; failures?: Array<{ name: string; error: string }> }
// ASSUMPTION: If staging doesn't have /test endpoint, fall back to running a shell command (Docker/SSH)
// For MVP: we'll assume staging has the endpoint. Shell fallback is week 2.

export interface TestOrchestratorConfig {
  stagingUrl: string;
  timeout: number; // milliseconds
  retries: number;
}

export interface TestResult {
  success: boolean;
  duration: number;
  failures?: Array<{
    name: string;
    error: string;
  }>;
  rawOutput?: string;
  error?: string;
}

export async function orchestrateTests(
  config: TestOrchestratorConfig,
  commitSha: string
): Promise<TestResult> {
  const { stagingUrl, timeout, retries } = config;
  let lastError: string = '';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      logger.info(
        `[TestRunner] Attempt ${attempt}/${retries} against ${stagingUrl} for commit ${commitSha}`
      );

      // Poll staging to ensure commit is deployed
      const deploymentReady = await waitForDeployment(stagingUrl, commitSha, timeout);
      if (!deploymentReady) {
        lastError = 'Staging deployment did not complete within timeout';
        logger.warn(`[TestRunner] ${lastError}`);
        continue;
      }

      // Hit the staging /test endpoint
      const response = await axios.post(
        `${stagingUrl}/test`,
        {
          commit: commitSha,
        },
        {
          timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result: TestResult = {
        success: response.data.success ?? false,
        duration: response.data.duration ?? 0,
        failures: response.data.failures,
        rawOutput: response.data.output,
      };

      logger.info(
        `[TestRunner] Test result: success=${result.success}, duration=${result.duration}ms`
      );
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      lastError = axiosError.message || String(error);
      logger.warn(
        `[TestRunner] Attempt ${attempt} failed: ${lastError}. ${
          attempt < retries ? `Retrying in 5s...` : 'No retries left.'
        }`
      );

      if (attempt < retries) {
        await sleep(5000); // Wait 5 seconds before retry
      }
    }
  }

  // All retries exhausted
  return {
    success: false,
    duration: 0,
    error: `Failed after ${retries} attempts: ${lastError}`,
  };
}

async function waitForDeployment(
  stagingUrl: string,
  commitSha: string,
  timeout: number
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(`${stagingUrl}/health`, {
        timeout: 5000,
        headers: {
          'X-Commit': commitSha,
        },
      });

      if (response.status === 200) {
        const deployedCommit = response.headers['x-deployed-commit'];
        if (deployedCommit === commitSha) {
          logger.info(
            `[TestRunner] Staging is healthy and running commit ${commitSha}`
          );
          return true;
        }
        logger.info(
          `[TestRunner] Staging healthy but running different commit. Expected ${commitSha}, got ${deployedCommit}`
        );
      }
    } catch (error) {
      logger.debug(`[TestRunner] Health check failed, retrying...`);
    }

    await sleep(pollInterval);
  }

  logger.warn(`[TestRunner] Deployment wait timeout after ${timeout}ms`);
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
import { RepoConfig } from '../config/repo-config';
import { orchestrateTests } from './orchestrator';

export interface TestContext {
  owner: string;
  repo: string;
  prNumber: number;
  config: RepoConfig;
}

export async function runTests(context: TestContext): Promise<boolean> {
  console.log(`[TestRunner] Starting test run for ${context.owner}/${context.repo} PR #${context.prNumber}`);

  const result = await orchestrateTests(context.config, context.prNumber);
  
  console.log(`[TestRunner] Result: ${result.testsPassed ? 'PASS' : 'FAIL'}`);
  return result.testsPassed;
}
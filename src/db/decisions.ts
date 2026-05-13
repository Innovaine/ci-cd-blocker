import fs from 'fs';
import path from 'path';

export interface Decision {
  prNumber: number;
  owner: string;
  repo: string;
  commitSha: string;
  branchName: string;
  allowed: boolean;
  reason: string;
  timestamp: string;
  testDuration?: number;
}

// ASSUMPTION: Using file-based storage at DECISIONS_FILE path
// This is not production-ready; future versions will use a real database
// File-based storage keeps the MVP simple and deployable without external deps

const DECISIONS_FILE = process.env.DECISIONS_FILE || '/tmp/decisions.json';

function ensureFile(): void {
  try {
    if (!fs.existsSync(DECISIONS_FILE)) {
      const dir = path.dirname(DECISIONS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DECISIONS_FILE, JSON.stringify([], null, 2));
      console.log(`[DB] Created decisions file at ${DECISIONS_FILE}`);
    }
  } catch (error) {
    console.error(`[DB] Error ensuring file: ${error}`);
    throw error;
  }
}

export function initializeDatabase(): void {
  try {
    ensureFile();
    console.log(`[DB] Initialized decisions file at ${DECISIONS_FILE}`);
  } catch (error) {
    console.error(`[DB] Failed to initialize database:`, error);
    throw error;
  }
}

export function recordDecision(decision: Decision): void {
  try {
    ensureFile();
    const content = fs.readFileSync(DECISIONS_FILE, 'utf-8');
    const decisions: Decision[] = JSON.parse(content);
    decisions.push(decision);
    fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
    console.log(`[DB] Recorded decision for PR #${decision.prNumber} in ${decision.owner}/${decision.repo}`);
  } catch (error) {
    console.error(`[DB] Error recording decision:`, error);
    throw error;
  }
}

export function getDecisionsForPR(owner: string, repo: string, prNumber: number): Decision | null {
  try {
    ensureFile();
    const content = fs.readFileSync(DECISIONS_FILE, 'utf-8');
    const decisions: Decision[] = JSON.parse(content);
    return decisions.find((d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber) || null;
  } catch (error) {
    console.error(`[DB] Error reading decisions:`, error);
    return null;
  }
}

export function getRecentDecisions(limit: number = 10): Decision[] {
  try {
    ensureFile();
    const content = fs.readFileSync(DECISIONS_FILE, 'utf-8');
    const decisions: Decision[] = JSON.parse(content);
    return decisions.slice(-limit).reverse(); // Newest first
  } catch (error) {
    console.error(`[DB] Error fetching recent decisions:`, error);
    return [];
  }
}
import * as fs from 'fs';
import * as path from 'path';

export interface Decision {
  prNumber: number;
  owner: string;
  repo: string;
  sha: string;
  timestamp: string;
  decision: 'approved' | 'blocked';
  reason: string;
  testsPassed?: boolean;
}

// ASSUMPTION: MVP uses JSON file storage in /tmp/decisions.json
// This is not production-ready; future versions will use a real database
// File-based storage keeps the MVP simple and deployable without external deps

const DECISIONS_FILE = process.env.DECISIONS_FILE || '/tmp/decisions.json';

function ensureFile(): void {
  if (!fs.existsSync(DECISIONS_FILE)) {
    fs.writeFileSync(DECISIONS_FILE, JSON.stringify([], null, 2));
  }
}

export function initializeDatabase(): void {
  ensureFile();
  console.log(`[DB] Initialized decisions file at ${DECISIONS_FILE}`);
}

export function recordDecision(decision: Decision): void {
  ensureFile();
  const decisions: Decision[] = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
  decisions.push(decision);
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2));
  console.log(`[DB] Recorded decision for PR #${decision.prNumber}`);
}

export function getDecisionsForPR(owner: string, repo: string, prNumber: number): Decision | null {
  ensureFile();
  const decisions: Decision[] = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
  return decisions.find((d) => d.owner === owner && d.repo === repo && d.prNumber === prNumber) || null;
}

export function getRecentDecisions(limit: number = 10): Decision[] {
  ensureFile();
  const decisions: Decision[] = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));
  return decisions.slice(-limit);
}
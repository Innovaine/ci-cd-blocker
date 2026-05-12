import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger';

// ASSUMPTION: SQLite is sufficient for MVP (single-instance bot)
// ASSUMPTION: Decisions table tracks every block/pass/override for audit
// ASSUMPTION: No schema migrations framework yet; manual ALTER TABLE if needed

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'blocker.db');

let db: Database.Database | null = null;

export function initializeDatabase(): Database.Database {
  if (db) return db;

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  logger.info(`Database initialized at ${dbPath}`);

  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      head_sha TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('blocked', 'passed')),
      test_passed BOOLEAN NOT NULL,
      failure_count INTEGER DEFAULT 0,
      failure_details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      pr_number INTEGER NOT NULL,
      overridden_by TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_decisions_repo ON decisions(owner, repo);
    CREATE INDEX IF NOT EXISTS idx_decisions_pr ON decisions(owner, repo, pr_number);
    CREATE INDEX IF NOT EXISTS idx_overrides_repo ON overrides(owner, repo);
  `);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database closed');
  }
}
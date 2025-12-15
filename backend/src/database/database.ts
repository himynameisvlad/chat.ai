import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { config } from '../config/app.config';
import { DatabaseError, MigrationError } from './errors';
import { migrations } from './migrations';

const DB_DIR = path.dirname(config.database.path);
const DB_PATH = config.database.path;

let sqliteDb: sqlite3.Database | null = null;
let isConnected = false;

export interface Database {
  get<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  run(sql: string, ...params: any[]): Promise<sqlite3.RunResult>;
  exec(sql: string): Promise<void>;
}

class DatabaseConnection implements Database {
  private ensureConnected(): void {
    if (!sqliteDb || !isConnected) {
      throw new DatabaseError('Database not connected', 'connection_check');
    }
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    this.ensureConnected();
    try {
      const fn = promisify(sqliteDb!.get.bind(sqliteDb)) as any;
      return await fn(sql, ...params) as T | undefined;
    } catch (error) {
      throw new DatabaseError('Failed to execute GET query', 'get', error as Error);
    }
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    this.ensureConnected();
    try {
      const fn = promisify(sqliteDb!.all.bind(sqliteDb)) as any;
      return await fn(sql, ...params) as T[];
    } catch (error) {
      throw new DatabaseError('Failed to execute ALL query', 'all', error as Error);
    }
  }

  async run(sql: string, ...params: any[]): Promise<sqlite3.RunResult> {
    this.ensureConnected();
    try {
      const fn = promisify(sqliteDb!.run.bind(sqliteDb)) as any;
      return await fn(sql, ...params);
    } catch (error) {
      throw new DatabaseError('Failed to execute RUN query', 'run', error as Error);
    }
  }

  async exec(sql: string): Promise<void> {
    this.ensureConnected();
    try {
      const fn = promisify(sqliteDb!.exec.bind(sqliteDb)) as any;
      return await fn(sql);
    } catch (error) {
      throw new DatabaseError('Failed to execute EXEC query', 'exec', error as Error);
    }
  }
}

export const db = new DatabaseConnection();

export async function connect(): Promise<void> {
  if (isConnected && sqliteDb) {
    return;
  }

  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    await new Promise<void>((resolve, reject) => {
      sqliteDb = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(new DatabaseError('Failed to connect to database', 'connect', err));
        } else {
          isConnected = true;
          resolve();
        }
      });
    });

    console.log(`📦 Database connected: ${DB_PATH}`);
  } catch (error) {
    throw new DatabaseError('Failed to initialize database connection', 'connect', error as Error);
  }
}

export async function disconnect(): Promise<void> {
  if (!sqliteDb || !isConnected) {
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      sqliteDb!.close((err) => {
        if (err) {
          reject(new DatabaseError('Failed to close database connection', 'disconnect', err));
        } else {
          sqliteDb = null;
          isConnected = false;
          console.log('📦 Database disconnected');
          resolve();
        }
      });
    });
  } catch (error) {
    throw new DatabaseError('Failed to disconnect from database', 'disconnect', error as Error);
  }
}

async function createMigrationsTable(): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(): Promise<string[]> {
  const results = await db.all<{ name: string }>('SELECT name FROM migrations ORDER BY id');
  return results.map(r => r.name);
}

async function applyMigration(name: string, sql: string): Promise<void> {
  try {
    await transaction(async () => {
      await db.exec(sql);
      await db.run('INSERT INTO migrations (name) VALUES (?)', name);
    });
    console.log(`✅ Applied migration: ${name}`);
  } catch (error) {
    throw new MigrationError(`Failed to apply migration: ${name}`, name, error as Error);
  }
}

export async function runMigrations(): Promise<void> {
  try {
    await createMigrationsTable();
    const applied = await getAppliedMigrations();
    const appliedSet = new Set(applied);

    for (const migration of migrations) {
      if (!appliedSet.has(migration.name)) {
        await applyMigration(migration.name, migration.up);
      }
    }

    console.log('✅ All migrations completed');
  } catch (error) {
    throw new DatabaseError('Failed to run migrations', 'migrations', error as Error);
  }
}

export async function transaction<T>(callback: () => Promise<T>): Promise<T> {
  await db.exec('BEGIN TRANSACTION');
  try {
    const result = await callback();
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw new DatabaseError('Transaction failed', 'transaction', error as Error);
  }
}

export async function initializeDatabase(): Promise<void> {
  await connect();
  await runMigrations();
}

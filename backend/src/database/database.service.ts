import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { Database as SqliteDatabase } from 'better-sqlite3';
const Database = require('better-sqlite3');
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private db: SqliteDatabase | null = null;
  private isConnected = false;
  private lastError: string | null = null;
  private readonly dbPath: string;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'gateway.sqlite');
  }

  async onModuleInit() {
    await this.initDatabase();
  }

  async onModuleDestroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async initDatabase(): Promise<boolean> {
    try {
      this.logger.log(`Initializing SQLite database at: ${this.dbPath}`);
      this.db = new Database(this.dbPath);
      // Enable WAL mode for high concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this.runMigrations();

      this.isConnected = true;
      this.lastError = null;
      this.logger.log(`SQLite connected successfully. Database: ${this.dbPath}`);
      return true;
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message || 'Unknown database error';
      this.logger.error(`Failed to initialize SQLite: ${this.lastError}`);
      return false;
    }
  }

  private runMigrations() {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        port INTEGER NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        strip_prefix INTEGER DEFAULT 1,
        last_health_status TEXT DEFAULT 'UNKNOWN',
        last_health_checked_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_nodes_slug ON nodes(slug);
      CREATE INDEX IF NOT EXISTS idx_nodes_port ON nodes(port);
      CREATE INDEX IF NOT EXISTS idx_nodes_is_active ON nodes(is_active);

      CREATE TABLE IF NOT EXISTS request_logs (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        method TEXT NOT NULL,
        original_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        target_port INTEGER NOT NULL,
        status_code INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        client_ip TEXT,
        user_agent TEXT,
        referer TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_logs_node_id ON request_logs(node_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_logs_status_code ON request_logs(status_code);

      CREATE TABLE IF NOT EXISTS gateway_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  async getSetting(key: string, defaultValue = ''): Promise<string> {
    try {
      if (!this.db) await this.initDatabase();
      const row = this.db!.prepare('SELECT setting_value FROM gateway_settings WHERE setting_key = ?').get(key) as any;
      if (row && row.setting_value !== undefined) {
        return row.setting_value;
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) await this.initDatabase();
    this.db!.prepare(`
      INSERT INTO gateway_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')
    `).run(key, value);
  }

  async getAllSettings(): Promise<Record<string, string>> {
    try {
      if (!this.db) await this.initDatabase();
      const rows = this.db!.prepare('SELECT setting_key, setting_value FROM gateway_settings').all() as any[];
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.setting_key] = row.setting_value;
      }
      return map;
    } catch {
      return {};
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T> {
    if (!this.db) {
      const initialized = await this.initDatabase();
      if (!initialized || !this.db) {
        throw new Error(`Database not initialized: ${this.lastError}`);
      }
    }
    try {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
        const rows = this.db.prepare(sql).all(...params);
        return rows as T;
      } else {
        const result = this.db.prepare(sql).run(...params);
        return result as T;
      }
    } catch (err: any) {
      this.lastError = err.message;
      throw err;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      const initialized = await this.initDatabase();
      if (!initialized || !this.db) {
        throw new Error(`Database not initialized: ${this.lastError}`);
      }
    }
    try {
      const result = this.db.prepare(sql).run(...params);
      return result;
    } catch (err: any) {
      this.lastError = err.message;
      throw err;
    }
  }

  getStatus() {
    return {
      connected: this.isConnected,
      type: 'sqlite',
      path: this.dbPath,
      database: 'gateway.sqlite',
      host: 'embedded',
      port: 0,
      user: 'local',
      lastError: this.lastError,
    };
  }
}

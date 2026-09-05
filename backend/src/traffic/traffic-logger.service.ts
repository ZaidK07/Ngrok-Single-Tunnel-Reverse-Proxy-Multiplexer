import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface RequestLogEntry {
  nodeId: string;
  method: string;
  originalPath: string;
  targetPath: string;
  targetPort: number;
  statusCode: number;
  latencyMs: number;
  clientIp?: string;
  userAgent?: string;
  referer?: string;
  errorMessage?: string;
}

@Injectable()
export class TrafficLoggerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TrafficLoggerService.name);
  private buffer: RequestLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        // Silently capture buffer flush errors
      });
    }, 1000);
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  logRequest(entry: RequestLogEntry) {
    this.buffer.push(entry);
    if (this.buffer.length >= 50) {
      this.flush().catch(() => {});
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;
    const items = [...this.buffer];
    this.buffer = [];

    try {
      for (const item of items) {
        await this.db.execute(
          `INSERT INTO request_logs 
           (id, node_id, method, original_path, target_path, target_port, status_code, latency_ms, client_ip, user_agent, referer, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            uuidv4(),
            item.nodeId,
            item.method.toUpperCase(),
            item.originalPath,
            item.targetPath,
            item.targetPort,
            item.statusCode,
            item.latencyMs,
            item.clientIp || null,
            item.userAgent ? item.userAgent.substring(0, 500) : null,
            item.referer ? item.referer.substring(0, 500) : null,
            item.errorMessage || null,
          ],
        );
      }
    } catch (err: any) {
      this.logger.error(`Error saving request logs to database: ${err.message}`);
    }
  }

  async getAllLogs(
    page = 1,
    limit = 50,
    search?: string,
    nodeId?: string,
    statusCode?: number,
    method?: string,
  ) {
    const offset = (page - 1) * limit;
    let query = 'SELECT r.*, n.name as node_name FROM request_logs r LEFT JOIN nodes n ON r.node_id = n.id WHERE 1=1';
    const params: any[] = [];

    if (nodeId) {
      query += ' AND r.node_id = ?';
      params.push(nodeId);
    }

    if (statusCode) {
      query += ' AND r.status_code = ?';
      params.push(statusCode);
    }

    if (method) {
      query += ' AND r.method = ?';
      params.push(method.toUpperCase());
    }

    if (search) {
      query += ' AND (r.original_path LIKE ? OR r.target_path LIKE ? OR r.error_message LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.db.query(query, params);

    // Count query
    let countQuery = 'SELECT COUNT(*) as total FROM request_logs r WHERE 1=1';
    const countParams: any[] = [];
    if (nodeId) {
      countQuery += ' AND r.node_id = ?';
      countParams.push(nodeId);
    }
    if (statusCode) {
      countQuery += ' AND r.status_code = ?';
      countParams.push(statusCode);
    }
    if (method) {
      countQuery += ' AND r.method = ?';
      countParams.push(method.toUpperCase());
    }
    if (search) {
      countQuery += ' AND (r.original_path LIKE ? OR r.target_path LIKE ? OR r.error_message LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await this.db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    let statusQuery = 'SELECT DISTINCT status_code FROM request_logs WHERE status_code IS NOT NULL';
    const statusParams: any[] = [];
    if (nodeId) {
      statusQuery += ' AND node_id = ?';
      statusParams.push(nodeId);
    }
    statusQuery += ' ORDER BY status_code ASC';
    const statusRows = await this.db.query(statusQuery, statusParams);
    const availableStatuses = (statusRows || [])
      .map((r: any) => Number(r.status_code))
      .filter((c: number) => !isNaN(c) && c > 0);

    return {
      logs: rows,
      availableStatuses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTrafficStats() {
    try {
      const stats = await this.db.query(`
        SELECT 
          COUNT(*) as totalRequests,
          AVG(latency_ms) as avgLatencyMs,
          SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as totalErrors,
          SUM(CASE WHEN created_at >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) as requests24h
        FROM request_logs
      `);

      const row = stats[0] || {};
      const total = Number(row.totalRequests) || 0;
      const errors = Number(row.totalErrors) || 0;
      const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : '0.0';

      return {
        totalRequests: total,
        avgLatencyMs: Math.round(Number(row.avgLatencyMs) || 0),
        totalErrors: errors,
        errorRate: `${errorRate}%`,
        requests24h: Number(row.requests24h) || 0,
      };
    } catch (err: any) {
      return {
        totalRequests: 0,
        avgLatencyMs: 0,
        totalErrors: 0,
        errorRate: '0.0%',
        requests24h: 0,
      };
    }
  }

  async clearLogs(days?: number) {
    if (days && days > 0) {
      await this.db.execute("DELETE FROM request_logs WHERE created_at < datetime('now', '-' || ? || ' days')", [days]);
      return { success: true, message: `Logs older than ${days} days cleared.` };
    } else {
      await this.db.execute('DELETE FROM request_logs');
      return { success: true, message: 'All request logs cleared.' };
    }
  }

  async getDistinctStatuses(nodeId?: string): Promise<number[]> {
    try {
      let query = 'SELECT DISTINCT status_code FROM request_logs WHERE status_code IS NOT NULL';
      const params: any[] = [];
      if (nodeId) {
        query += ' AND node_id = ?';
        params.push(nodeId);
      }
      query += ' ORDER BY status_code ASC';
      const rows = await this.db.query(query, params);
      return rows
        .map((r: any) => Number(r.status_code))
        .filter((c: number) => !isNaN(c) && c > 0);
    } catch {
      return [];
    }
  }

  async getDistinctMethods(nodeId?: string): Promise<string[]> {
    try {
      let query = 'SELECT DISTINCT method FROM request_logs WHERE method IS NOT NULL';
      const params: any[] = [];
      if (nodeId) {
        query += ' AND node_id = ?';
        params.push(nodeId);
      }
      query += ' ORDER BY method ASC';
      const rows = await this.db.query(query, params);
      return rows
        .map((r: any) => String(r.method).toUpperCase().trim())
        .filter((m: string) => m.length > 0);
    } catch {
      return [];
    }
  }
}

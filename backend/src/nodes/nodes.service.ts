import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateNodeDto, UpdateNodeDto } from './dto/create-node.dto';
import { NodeEntity } from './node.interface';
import * as net from 'net';

export const RESERVED_SLUGS = [
  'dashboard',
  'api',
  'health',
  'static',
  'assets',
  'favicon.ico',
  'socket.io',
  'ngrok',
  'traffic',
  'settings',
];

@Injectable()
export class NodesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NodesService.name);
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    // Run an initial health check on all nodes and poll every 10 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkAllNodesHealth().catch((err) => {
        // Silently capture background check failures
      });
    }, 10000);
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  async findAll(): Promise<NodeEntity[]> {
    try {
      const rows = await this.db.query<NodeEntity[]>(
        'SELECT * FROM nodes ORDER BY created_at DESC',
      );
      return rows.map((r) => ({
        ...r,
        is_active: Boolean(r.is_active),
        strip_prefix: Boolean(r.strip_prefix),
      }));
    } catch (err: any) {
      this.logger.error(`Error loading nodes: ${err.message}`);
      return [];
    }
  }

  async findById(id: string): Promise<NodeEntity> {
    const rows = await this.db.query<NodeEntity[]>(
      'SELECT * FROM nodes WHERE id = ?',
      [id],
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Node with ID '${id}' not found`);
    }
    const node = rows[0];
    return {
      ...node,
      is_active: Boolean(node.is_active),
      strip_prefix: Boolean(node.strip_prefix),
    };
  }

  async findBySlug(slug: string): Promise<NodeEntity | null> {
    try {
      const rows = await this.db.query<NodeEntity[]>(
        'SELECT * FROM nodes WHERE slug = ? OR id = ? LIMIT 1',
        [slug, slug],
      );
      if (!rows || rows.length === 0) return null;
      const node = rows[0];
      return {
        ...node,
        is_active: Boolean(node.is_active),
        strip_prefix: Boolean(node.strip_prefix),
      };
    } catch (err) {
      return null;
    }
  }

  async create(dto: CreateNodeDto): Promise<NodeEntity> {
    const slug = dto.id.trim().toLowerCase();

    // Check reserved slugs
    if (RESERVED_SLUGS.includes(slug)) {
      throw new BadRequestException(
        `Node ID '${slug}' is a reserved system path and cannot be used.`,
      );
    }

    // Check if ID / Slug already exists
    const existing = await this.findBySlug(slug);
    if (existing) {
      throw new ConflictException(
        `A node with Node ID '${slug}' already exists. Please choose a unique ID.`,
      );
    }

    // Insert into MySQL
    const id = slug; // ID is the unique identifier
    const stripPrefix = dto.strip_prefix !== undefined ? dto.strip_prefix : true;

    await this.db.execute(
      `INSERT INTO nodes (id, name, port, slug, description, is_active, strip_prefix, last_health_status, last_health_checked_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, 'UNKNOWN', NULL)`,
      [id, dto.name.trim(), dto.port, slug, dto.description || null, stripPrefix ? 1 : 0],
    );

    // Run quick health check on created port
    const isHealthy = await this.pingPort(dto.port);
    const status = isHealthy ? 'HEALTHY' : 'UNREACHABLE';
    await this.db.execute(
      "UPDATE nodes SET last_health_status = ?, last_health_checked_at = datetime('now') WHERE id = ?",
      [status, id],
    );

    return this.findById(id);
  }

  async update(id: string, dto: UpdateNodeDto): Promise<NodeEntity> {
    const node = await this.findById(id);

    const name = dto.name !== undefined ? dto.name.trim() : node.name;
    const port = dto.port !== undefined ? dto.port : node.port;
    const description = dto.description !== undefined ? dto.description : node.description;
    const isActive = dto.is_active !== undefined ? dto.is_active : node.is_active;
    const stripPrefix = dto.strip_prefix !== undefined ? dto.strip_prefix : node.strip_prefix;

    await this.db.execute(
      `UPDATE nodes SET name = ?, port = ?, description = ?, is_active = ?, strip_prefix = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [name, port, description, isActive ? 1 : 0, stripPrefix ? 1 : 0, id],
    );

    return this.findById(id);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    await this.findById(id);
    await this.db.execute('DELETE FROM request_logs WHERE node_id = ?', [id]);
    await this.db.execute('DELETE FROM nodes WHERE id = ?', [id]);
    return { success: true, message: `Node '${id}' and associated logs deleted successfully.` };
  }

  async pingNode(id: string): Promise<{ id: string; port: number; status: 'HEALTHY' | 'UNREACHABLE'; latencyMs: number }> {
    const node = await this.findById(id);
    const start = Date.now();
    const isHealthy = await this.pingPort(node.port);
    const latencyMs = Date.now() - start;
    const status = isHealthy ? 'HEALTHY' : 'UNREACHABLE';

    await this.db.execute(
      "UPDATE nodes SET last_health_status = ?, last_health_checked_at = datetime('now') WHERE id = ?",
      [status, id],
    );

    return { id: node.id, port: node.port, status, latencyMs };
  }

  async checkAllNodesHealth() {
    try {
      const nodes = await this.db.query<NodeEntity[]>('SELECT id, port FROM nodes WHERE is_active = 1');
      for (const node of nodes) {
        const isHealthy = await this.pingPort(node.port);
        const status = isHealthy ? 'HEALTHY' : 'UNREACHABLE';
        await this.db.execute(
          "UPDATE nodes SET last_health_status = ?, last_health_checked_at = datetime('now') WHERE id = ?",
          [status, node.id],
        );
      }
    } catch (err) {
      // Database might be reconnecting
    }
  }

  pingPort(port: number, timeoutMs = 1500): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  async getNodeLogs(
    id: string,
    page = 1,
    limit = 50,
    search?: string,
    statusCode?: number,
  ) {
    await this.findById(id);
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM request_logs WHERE node_id = ?';
    const params: any[] = [id];

    if (statusCode) {
      query += ' AND status_code = ?';
      params.push(statusCode);
    }

    if (search) {
      query += ' AND (original_path LIKE ? OR target_path LIKE ? OR method LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.db.query(query, params);

    // Get count
    let countQuery = 'SELECT COUNT(*) as total FROM request_logs WHERE node_id = ?';
    const countParams: any[] = [id];
    if (statusCode) {
      countQuery += ' AND status_code = ?';
      countParams.push(statusCode);
    }
    if (search) {
      countQuery += ' AND (original_path LIKE ? OR target_path LIKE ? OR method LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countResult = await this.db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    const statusRows = await this.db.query(
      'SELECT DISTINCT status_code FROM request_logs WHERE node_id = ? AND status_code IS NOT NULL ORDER BY status_code ASC',
      [id],
    );
    const availableStatuses = (statusRows || [])
      .map((r: any) => Number(r.status_code))
      .filter((c: number) => !isNaN(c) && c > 0);

    return {
      nodeId: id,
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
}

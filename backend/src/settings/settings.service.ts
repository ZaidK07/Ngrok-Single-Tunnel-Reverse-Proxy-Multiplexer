import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NgrokService } from '../ngrok/ngrok.service';
import { NodesService } from '../nodes/nodes.service';

@Injectable()
export class SettingsService {
  private startTime = Date.now();

  constructor(
    private readonly db: DatabaseService,
    private readonly ngrokService: NgrokService,
    private readonly nodesService: NodesService,
  ) {}

  async getSystemInfo() {
    const dbStatus = this.db.getStatus();
    const ngrokStatus = this.ngrokService.getStatus();
    const nodes = await this.nodesService.findAll();

    let logsCount = 0;
    try {
      const logsResult = await this.db.query('SELECT COUNT(*) as count FROM request_logs');
      logsCount = logsResult[0]?.count || 0;
    } catch (err) {
      // Ignore
    }

    const dbSettings = await this.db.getAllSettings();

    return {
      database: dbStatus,
      gateway: {
        port: parseInt(dbSettings.gateway_port || '7779', 10),
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage(),
      },
      ngrok: {
        status: ngrokStatus.status,
        publicUrl: ngrokStatus.publicUrl,
        mode: ngrokStatus.mode,
        configuredDomain: dbSettings.ngrok_domain || null,
        hasAuthToken: Boolean(dbSettings.ngrok_authtoken),
        authToken: dbSettings.ngrok_authtoken || '',
      },
      stats: {
        totalNodes: nodes.length,
        activeNodes: nodes.filter((n) => n.is_active).length,
        healthyNodes: nodes.filter((n) => n.last_health_status === 'HEALTHY').length,
        totalLogs: logsCount,
      },
    };
  }

  async getConfigSettings() {
    const dbSettings = await this.db.getAllSettings();
    return {
      ngrok_authtoken: dbSettings.ngrok_authtoken || '',
      ngrok_domain: dbSettings.ngrok_domain || '',
      gateway_port: dbSettings.gateway_port || '7779',
      traffic_refresh_interval: parseInt(dbSettings.traffic_refresh_interval || '3', 10),
      traffic_auto_refresh: dbSettings.traffic_auto_refresh !== 'false',
      database: this.db.getStatus(),
    };
  }

  async updateConfigSettings(payload: {
    ngrok_authtoken?: string;
    ngrok_domain?: string;
    gateway_port?: string | number;
    traffic_refresh_interval?: string | number;
    traffic_auto_refresh?: boolean;
  }) {
    if (payload.ngrok_authtoken !== undefined) {
      await this.db.setSetting('ngrok_authtoken', payload.ngrok_authtoken.trim());
    }
    if (payload.ngrok_domain !== undefined) {
      await this.db.setSetting('ngrok_domain', payload.ngrok_domain.trim());
    }
    if (payload.gateway_port !== undefined) {
      await this.db.setSetting('gateway_port', String(payload.gateway_port).trim());
    }
    if (payload.traffic_refresh_interval !== undefined) {
      await this.db.setSetting('traffic_refresh_interval', String(payload.traffic_refresh_interval).trim());
    }
    if (payload.traffic_auto_refresh !== undefined) {
      await this.db.setSetting('traffic_auto_refresh', String(payload.traffic_auto_refresh));
    }
    return { success: true, message: 'Settings updated successfully in database.' };
  }
}

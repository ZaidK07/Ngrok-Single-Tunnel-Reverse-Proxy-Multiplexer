import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import * as ngrok from '@ngrok/ngrok';

export interface NgrokStatus {
  status: 'ONLINE' | 'STOPPED' | 'ERROR';
  publicUrl: string | null;
  configuredDomain?: string;
  gatewayPort: number;
  mode: 'EXTERNAL_AGENT' | 'MANAGED' | 'NONE';
  region?: string;
  account?: string;
  errorMessage?: string;
  lastCheckedAt: Date;
}

@Injectable()
export class NgrokService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NgrokService.name);
  private managedListener: any = null;
  private currentStatus: NgrokStatus = {
    status: 'STOPPED',
    publicUrl: null,
    gatewayPort: 7779,
    mode: 'NONE',
    lastCheckedAt: new Date(),
  };
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    // Initial status probe
    await this.probeNgrokStatus();

    // Check if token exists before auto-starting
    const token = await this.db.getSetting('ngrok_authtoken', '');
    if (token && this.currentStatus.status !== 'ONLINE') {
      this.logger.log('Ngrok token detected. Auto-starting ngrok tunnel service...');
      this.startTunnel().catch((err) => {
        this.logger.warn(
          `Auto-starting ngrok tunnel failed: ${err.message}. Can be started manually in dashboard.`,
        );
      });
    }

    // Poll every 4 seconds to keep real-time sync with ngrok
    this.pollTimer = setInterval(() => {
      this.probeNgrokStatus().catch(() => {});
    }, 4000);
  }

  async onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    await this.stopTunnel();
  }

  async probeNgrokStatus(): Promise<NgrokStatus> {
    const configuredDomain = (
      await this.db.getSetting('ngrok_domain', '')
    ).trim();
    const gatewayPortStr = await this.db.getSetting('gateway_port', '7779');
    const gatewayPort = parseInt(gatewayPortStr, 10) || 7779;
    const localApiUrl = process.env.NGROK_LOCAL_API || 'http://127.0.0.1:4040';

    // 1. First check if an external ngrok session is running on local inspection port (4040)
    try {
      const response = await axios.get(`${localApiUrl}/api/tunnels`, {
        timeout: 2000,
      });

      const tunnels = response.data?.tunnels || [];
      if (tunnels.length > 0) {
        // Find https tunnel or first tunnel
        const httpsTunnel = tunnels.find((t: any) => t.public_url?.startsWith('https://')) || tunnels[0];
        const publicUrl = httpsTunnel?.public_url || null;

        this.currentStatus = {
          status: 'ONLINE',
          publicUrl,
          configuredDomain,
          gatewayPort,
          mode: 'EXTERNAL_AGENT',
          lastCheckedAt: new Date(),
        };
        return this.currentStatus;
      }
    } catch (err) {
      // Port 4040 is not responding (no external ngrok process)
    }

    // 2. Check if we have an active managed listener
    if (this.managedListener) {
      const url = this.managedListener.url ? this.managedListener.url() : null;
      if (url) {
        this.currentStatus = {
          status: 'ONLINE',
          publicUrl: url,
          configuredDomain,
          gatewayPort,
          mode: 'MANAGED',
          lastCheckedAt: new Date(),
        };
        return this.currentStatus;
      }
    }

    // 3. Fallback
    this.currentStatus = {
      status: 'STOPPED',
      publicUrl: null,
      configuredDomain,
      gatewayPort,
      mode: 'NONE',
      lastCheckedAt: new Date(),
    };
    return this.currentStatus;
  }

  async startTunnel(): Promise<NgrokStatus> {
    // Check if already online
    await this.probeNgrokStatus();
    if (this.currentStatus.status === 'ONLINE') {
      return this.currentStatus;
    }

    const gatewayPortStr = await this.db.getSetting('gateway_port', '7779');
    const gatewayPort = parseInt(gatewayPortStr, 10) || 7779;
    const authtoken = (await this.db.getSetting('ngrok_authtoken', '')).trim();
    const domain = (await this.db.getSetting('ngrok_domain', '')).trim();

    if (!authtoken) {
      this.currentStatus = {
        status: 'STOPPED',
        publicUrl: null,
        gatewayPort,
        mode: 'NONE',
        errorMessage: 'Ngrok Auth Token is not configured. Please complete setup.',
        lastCheckedAt: new Date(),
      };
      return this.currentStatus;
    }

    try {
      this.logger.log(`Starting managed ngrok tunnel forwarding to port ${gatewayPort}...`);
      
      const forwardOptions: any = {
        addr: gatewayPort,
        authtoken: authtoken || undefined,
      };

      if (domain) {
        forwardOptions.domain = domain;
      }

      this.managedListener = await ngrok.forward(forwardOptions);
      const url = this.managedListener.url();
      this.logger.log(`Managed ngrok tunnel online at: ${url}`);

      this.currentStatus = {
        status: 'ONLINE',
        publicUrl: url,
        gatewayPort,
        mode: 'MANAGED',
        lastCheckedAt: new Date(),
      };
      return this.currentStatus;
    } catch (err: any) {
      this.logger.error(`Failed to start managed ngrok tunnel: ${err.message}`);
      this.currentStatus = {
        status: 'ERROR',
        publicUrl: null,
        gatewayPort,
        mode: 'NONE',
        errorMessage: err.message || 'Failed to start tunnel',
        lastCheckedAt: new Date(),
      };
      return this.currentStatus;
    }
  }

  async stopTunnel(): Promise<NgrokStatus> {
    if (this.managedListener) {
      try {
        await this.managedListener.close();
        this.managedListener = null;
        this.logger.log('Managed ngrok tunnel stopped.');
      } catch (err: any) {
        this.logger.error(`Error closing ngrok tunnel: ${err.message}`);
      }
    }

    const gatewayPortStr = await this.db.getSetting('gateway_port', '7779');
    const gatewayPort = parseInt(gatewayPortStr, 10) || 7779;

    this.currentStatus = {
      status: 'STOPPED',
      publicUrl: null,
      gatewayPort,
      mode: 'NONE',
      lastCheckedAt: new Date(),
    };
    return this.currentStatus;
  }

  getStatus(): NgrokStatus {
    return this.currentStatus;
  }

  getPublicUrl(): string | null {
    return this.currentStatus.publicUrl;
  }
}

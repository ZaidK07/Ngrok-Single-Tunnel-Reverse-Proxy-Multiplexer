import { Controller, Get, Post, Body, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NgrokService } from '../ngrok/ngrok.service';

export interface ConfigureGatewayDto {
  authtoken: string;
  domain?: string;
  gatewayPort?: number;
}

@Controller('api/setup')
export class SetupController {
  constructor(
    private readonly db: DatabaseService,
    private readonly ngrokService: NgrokService,
  ) {}

  @Get('status')
  async getStatus() {
    const authtoken = (await this.db.getSetting('ngrok_authtoken', '')).trim();
    const domain = (await this.db.getSetting('ngrok_domain', '')).trim();
    const gatewayPortStr = await this.db.getSetting('gateway_port', '7779');
    const gatewayPort = parseInt(gatewayPortStr, 10) || 7779;
    const ngrokStatus = this.ngrokService.getStatus();

    const isConfigured = Boolean(authtoken);

    return {
      success: true,
      data: {
        isConfigured,
        hasAuthToken: isConfigured,
        configuredDomain: domain || null,
        gatewayPort,
        dbStatus: this.db.getStatus(),
        ngrokStatus,
      },
    };
  }

  @Post('configure')
  async configure(@Body() body: ConfigureGatewayDto) {
    if (!body || !body.authtoken || !body.authtoken.trim()) {
      throw new BadRequestException('Ngrok authtoken is required to launch the gateway.');
    }

    const authtoken = body.authtoken.trim();
    const domain = body.domain ? body.domain.trim() : '';
    const gatewayPort = body.gatewayPort ? Number(body.gatewayPort) : 7779;

    await this.db.setSetting('ngrok_authtoken', authtoken);
    await this.db.setSetting('ngrok_domain', domain);
    await this.db.setSetting('gateway_port', String(gatewayPort));

    // Start or restart ngrok tunnel
    await this.ngrokService.stopTunnel();
    const status = await this.ngrokService.startTunnel();

    return {
      success: true,
      message: 'Gateway configured successfully!',
      data: status,
    };
  }
}

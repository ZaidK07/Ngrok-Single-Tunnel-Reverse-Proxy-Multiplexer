import { Controller, Get, Post } from '@nestjs/common';
import { NgrokService } from './ngrok.service';

@Controller('api/ngrok')
export class NgrokController {
  constructor(private readonly ngrokService: NgrokService) {}

  @Get('status')
  async getStatus() {
    const status = await this.ngrokService.probeNgrokStatus();
    return { success: true, data: status };
  }

  @Post('start')
  async start() {
    const status = await this.ngrokService.startTunnel();
    return { success: true, data: status };
  }

  @Post('stop')
  async stop() {
    const status = await this.ngrokService.stopTunnel();
    return { success: true, data: status };
  }
}

import { Controller, Get, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('info')
  async getInfo() {
    const info = await this.settingsService.getSystemInfo();
    return { success: true, data: info };
  }

  @Get('config')
  async getConfig() {
    const config = await this.settingsService.getConfigSettings();
    return { success: true, data: config };
  }

  @Post('config')
  async updateConfig(@Body() body: any) {
    const result = await this.settingsService.updateConfigSettings(body);
    return result;
  }
}

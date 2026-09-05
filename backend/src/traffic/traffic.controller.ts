import {
  Controller,
  Get,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TrafficLoggerService } from './traffic-logger.service';

@Controller('api/traffic')
export class TrafficController {
  constructor(private readonly trafficService: TrafficLoggerService) {}

  @Get()
  async getLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('nodeId') nodeId?: string,
    @Query('status') status?: string,
    @Query('method') method?: string,
  ) {
    const statusCode = status ? parseInt(status, 10) : undefined;
    const result = await this.trafficService.getAllLogs(
      page,
      limit,
      search,
      nodeId,
      statusCode,
      method,
    );
    return { success: true, data: result };
  }

  @Get('stats')
  async getStats() {
    const stats = await this.trafficService.getTrafficStats();
    return { success: true, data: stats };
  }

  @Get('statuses')
  async getStatuses(@Query('nodeId') nodeId?: string) {
    const statuses = await this.trafficService.getDistinctStatuses(nodeId);
    return { success: true, data: statuses };
  }

  @Get('methods')
  async getMethods(@Query('nodeId') nodeId?: string) {
    const methods = await this.trafficService.getDistinctMethods(nodeId);
    return { success: true, data: methods };
  }

  @Delete('clear')
  async clearLogs(@Query('days') days?: string) {
    const numDays = days ? parseInt(days, 10) : undefined;
    const result = await this.trafficService.clearLogs(numDays);
    return result;
  }
}

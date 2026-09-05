import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { NodesService } from './nodes.service';
import { CreateNodeDto, UpdateNodeDto } from './dto/create-node.dto';

@Controller('api/nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  async getAll() {
    const nodes = await this.nodesService.findAll();
    return { success: true, count: nodes.length, data: nodes };
  }

  @Post()
  async create(@Body() dto: CreateNodeDto) {
    const node = await this.nodesService.create(dto);
    return { success: true, message: 'Node created successfully', data: node };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const node = await this.nodesService.findById(id);
    return { success: true, data: node };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateNodeDto) {
    const updated = await this.nodesService.update(id, dto);
    return { success: true, message: 'Node updated successfully', data: updated };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const result = await this.nodesService.delete(id);
    return result;
  }

  @Post(':id/ping')
  async ping(@Param('id') id: string) {
    const result = await this.nodesService.pingNode(id);
    return { success: true, data: result };
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string, @Res() res: any) {
    const node = await this.nodesService.findById(id);
    res.setHeader('Set-Cookie', `__active_node=${node.slug}; Path=/; SameSite=Lax`);
    return res.json({
      success: true,
      message: `Node '${node.name}' is now active on root domain.`,
      data: node,
    });
  }

  @Get(':id/logs')
  async getLogs(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const statusCode = status ? parseInt(status, 10) : undefined;
    const result = await this.nodesService.getNodeLogs(
      id,
      page,
      limit,
      search,
      statusCode,
    );
    return { success: true, data: result };
  }
}

import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { NodesModule } from '../nodes/nodes.module';

@Module({
  imports: [NodesModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}

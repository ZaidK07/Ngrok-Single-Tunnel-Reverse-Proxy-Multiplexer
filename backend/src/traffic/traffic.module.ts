import { Module, Global } from '@nestjs/common';
import { TrafficLoggerService } from './traffic-logger.service';
import { TrafficController } from './traffic.controller';

@Global()
@Module({
  controllers: [TrafficController],
  providers: [TrafficLoggerService],
  exports: [TrafficLoggerService],
})
export class TrafficModule {}

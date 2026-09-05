import { Module, Global } from '@nestjs/common';
import { NgrokService } from './ngrok.service';
import { NgrokController } from './ngrok.controller';

@Global()
@Module({
  controllers: [NgrokController],
  providers: [NgrokService],
  exports: [NgrokService],
})
export class NgrokModule {}

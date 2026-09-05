import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { NgrokModule } from './ngrok/ngrok.module';
import { NodesModule } from './nodes/nodes.module';
import { TrafficModule } from './traffic/traffic.module';
import { ProxyModule } from './proxy/proxy.module';
import { ProxyMiddleware } from './proxy/proxy.middleware';
import { SettingsModule } from './settings/settings.module';
import { AppController } from './app.controller';
import { SetupController } from './setup/setup.controller';

@Module({
  imports: [
    DatabaseModule,
    NgrokModule,
    NodesModule,
    TrafficModule,
    ProxyModule,
    SettingsModule,
  ],
  controllers: [AppController, SetupController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProxyMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

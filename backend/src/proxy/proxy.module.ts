import { Module, Global } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyMiddleware } from './proxy.middleware';
import { NodesModule } from '../nodes/nodes.module';

@Global()
@Module({
  imports: [NodesModule],
  providers: [ProxyService, ProxyMiddleware],
  exports: [ProxyService, ProxyMiddleware],
})
export class ProxyModule {}

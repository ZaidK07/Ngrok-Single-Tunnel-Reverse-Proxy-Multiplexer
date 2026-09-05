import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ProxyService } from './proxy/proxy.service';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Enable graceful shutdown hooks to cleanly release ports, connections, and ngrok tunnels
  app.enableShutdownHooks();

  // Enable CORS for frontend development
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Serve static assets from frontend/dist strictly under /dashboard
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use('/dashboard', express.static(frontendDist));
  }

  // Hook into native HTTP server for WebSocket upgrade forwarding
  const server = app.getHttpServer();
  const proxyService = app.get(ProxyService);

  server.on('upgrade', async (req: any, socket: any, head: any) => {
    try {
      const resolved = await proxyService.resolveTargetNode(req);
      if (resolved && resolved.node.is_active) {
        proxyService.handleWebSocketUpgrade(req, socket, head, resolved.node);
      } else {
        socket.destroy();
      }
    } catch (err: any) {
      logger.error(`WebSocket upgrade routing error: ${err.message}`);
      socket.destroy();
    }
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 7779;
  await app.listen(port);
  logger.log(`====================================================`);
  logger.log(`  NGROK MULTI-REDIRECT GATEWAY ONLINE`);
  logger.log(`  Listening on Port: http://localhost:${port}`);
  logger.log(`  Storage Engine: Embedded SQLite (data/gateway.sqlite)`);
  logger.log(`====================================================`);
}

bootstrap();

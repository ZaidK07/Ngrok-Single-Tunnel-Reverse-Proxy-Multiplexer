import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ProxyService } from './proxy.service';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  constructor(private readonly proxyService: ProxyService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const rawPath = req.url || '/';

    // Skip internal API routes and dashboard
    if (
      rawPath.startsWith('/api/') ||
      rawPath === '/api' ||
      rawPath.startsWith('/dashboard') ||
      rawPath === '/dashboard'
    ) {
      return next();
    }

    const startTime = Date.now();
    const resolved = await this.proxyService.resolveTargetNode(req);

    if (resolved) {
      const { node } = resolved;

      if (!node.is_active) {
        return res.status(503).json({
          statusCode: 503,
          error: 'Service Unavailable',
          message: `Node '${node.name}' (${node.id}) is currently paused.`,
        });
      }

      // Proxy request to the node's local target port
      return this.proxyService.forwardHttpRequest(
        req,
        res,
        resolved,
        startTime,
      );
    }

    // If request does not match any node and hits root /, redirect to dashboard
    if (rawPath === '/' || rawPath === '') {
      return res.redirect('/dashboard/');
    }

    next();
  }
}

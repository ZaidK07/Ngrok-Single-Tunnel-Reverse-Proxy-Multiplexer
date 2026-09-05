import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as httpProxy from 'http-proxy';
import { Request, Response } from 'express';
import { NodesService } from '../nodes/nodes.service';
import { TrafficLoggerService } from '../traffic/traffic-logger.service';
import { NodeEntity } from '../nodes/node.interface';
import * as http from 'http';

export interface ResolvedNode {
  node: NodeEntity;
  targetPath: string;
  matchedTier: 1 | 2 | 3;
  isSwitchRedirect?: boolean;
}

@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly logger = new Logger(ProxyService.name);
  private proxy: httpProxy;

  constructor(
    private readonly nodesService: NodesService,
    private readonly trafficLogger: TrafficLoggerService,
  ) {
    this.proxy = httpProxy.createProxyServer({
      ws: true,
      changeOrigin: true,
      xfwd: true,
      secure: false,
    });

    this.proxy.on('error', (err, req: any, res: any) => {
      this.logger.error(`Proxy forward error for ${req?.url}: ${err.message}`);
      if (res && !res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `Could not connect to target local port. Is your local application running on that port? (${err.message})`,
        });
      }
    });
  }

  onModuleInit() {
    this.logger.log('Reverse Proxy Engine online with Active Node Root Session Multiplexing.');
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
      const [k, v] = part.trim().split('=');
      if (k && v) acc[k.trim()] = decodeURIComponent(v.trim());
      return acc;
    }, {} as Record<string, string>);
  }

  /**
   * Resolves which node handles this request:
   * 1. /switch/<node_slug> -> Sets cookie and redirects to root /
   * 2. Browser visiting /<node_slug> or /<node_slug>/ with text/html -> Sets cookie and redirects to root /
   * 3. Explicit Path matching /<node_slug>/... for APIs/Webhooks
   * 4. Referer header matching
   * 5. Active Node Cookie (__active_node) for Root / and all subpaths
   */
  async resolveTargetNode(req: any): Promise<ResolvedNode | null> {
    const rawPath = req.url || '/';
    const pathWithoutQuery = rawPath.split('?')[0];
    const segments = pathWithoutQuery.split('/').filter(Boolean);

    // Reserved system paths that should never be proxied to target nodes
    if (
      rawPath.startsWith('/api/') ||
      rawPath === '/api' ||
      rawPath.startsWith('/dashboard') ||
      rawPath === '/dashboard'
    ) {
      return null;
    }

    const allActiveNodes = await this.nodesService.findAll();
    const activeNodesMap = new Map<string, NodeEntity>();
    for (const node of allActiveNodes) {
      if (node.is_active) {
        activeNodesMap.set(node.slug.toLowerCase(), node);
        activeNodesMap.set(node.id.toLowerCase(), node);
      }
    }

    if (activeNodesMap.size === 0) {
      return null;
    }

    // =========================================================================
    // 1. Explicit Switch Route: /switch/<node_slug>
    // Sets active node cookie and redirects to root domain /
    // =========================================================================
    if (segments.length >= 2 && segments[0].toLowerCase() === 'switch') {
      const targetSlug = segments[1].toLowerCase();
      const node = activeNodesMap.get(targetSlug);
      if (node) {
        return {
          node,
          targetPath: '/',
          matchedTier: 1,
          isSwitchRedirect: true,
        };
      }
    }

    // =========================================================================
    // 2. Browser Navigation to /<node_slug> or /<node_slug>/...
    // If a browser with HTML accept navigates to the node, switch cookie and redirect to root / or clean subpath!
    // =========================================================================
    if (segments.length >= 1 && req.method === 'GET') {
      const candidateSlug = segments[0].toLowerCase();
      const node = activeNodesMap.get(candidateSlug);
      const acceptsHtml = (req.headers?.accept || '').includes('text/html');

      if (node && acceptsHtml) {
        let redirectPath = '/';
        if (segments.length > 1) {
          const prefix = `/${segments[0]}`;
          redirectPath = rawPath.substring(prefix.length) || '/';
          if (!redirectPath.startsWith('/')) {
            redirectPath = `/${redirectPath}`;
          }
        }
        return {
          node,
          targetPath: redirectPath,
          matchedTier: 1,
          isSwitchRedirect: true,
        };
      }
    }

    // =========================================================================
    // 3. Explicit Path Namespace Match (e.g. /<node_slug>/api/webhook)
    // Used by external API callers, webhooks, and explicit path requests
    // =========================================================================
    if (segments.length > 0) {
      const candidateSlug = segments[0].toLowerCase();
      const node = activeNodesMap.get(candidateSlug);
      if (node) {
        let targetPath = rawPath;
        if (node.strip_prefix) {
          const prefix = `/${segments[0]}`;
          targetPath = rawPath.substring(prefix.length) || '/';
          if (!targetPath.startsWith('/')) {
            targetPath = `/${targetPath}`;
          }
        }
        return { node, targetPath, matchedTier: 1 };
      }
    }

    // =========================================================================
    // 4. Referer Header Scoping
    // =========================================================================
    const referer = req.headers?.['referer'] || req.headers?.['referrer'];
    if (referer && typeof referer === 'string') {
      try {
        const refUrl = new URL(referer);
        const refSegments = refUrl.pathname.split('/').filter(Boolean);
        for (const seg of refSegments) {
          const node = activeNodesMap.get(seg.toLowerCase());
          if (node) {
            return { node, targetPath: rawPath, matchedTier: 2 };
          }
        }
      } catch {
        // Ignore
      }
    }

    // =========================================================================
    // 5. Active Node Cookie (__active_node)
    // Routes Root / and all SPA assets natively to the active node port
    // =========================================================================
    const cookies = this.parseCookies(req.headers?.cookie);
    const activeNodeCookie = cookies['__active_node'];
    if (activeNodeCookie) {
      const node = activeNodesMap.get(activeNodeCookie.toLowerCase());
      if (node) {
        return { node, targetPath: rawPath, matchedTier: 3 };
      }
    }

    // If no cookie set but there is an active node, default to the first active node for root /
    if ((rawPath === '/' || rawPath === '') && allActiveNodes.length > 0) {
      const defaultNode = allActiveNodes.find((n) => n.is_active);
      if (defaultNode) {
        return { node: defaultNode, targetPath: '/', matchedTier: 3 };
      }
    }

    return null;
  }

  /**
   * Forward HTTP Request to target node
   */
  async forwardHttpRequest(
    req: Request,
    res: Response,
    resolved: ResolvedNode,
    startTime: number,
  ) {
    const { node, targetPath, isSwitchRedirect } = resolved;
    const originalUrl = req.url;

    // 1. Switch Redirect: Set active node cookie and redirect browser to root /
    if (isSwitchRedirect) {
      res.setHeader('Set-Cookie', `__active_node=${node.slug}; Path=/; SameSite=Lax`);
      return res.redirect(302, '/');
    }

    // 2. Always refresh sticky cookie
    res.setHeader('Set-Cookie', `__active_node=${node.slug}; Path=/; SameSite=Lax`);

    req.url = targetPath; // Set forwarded path
    const targetUrl = `http://127.0.0.1:${node.port}`;

    // Intercept response finish for traffic logging
    res.on('finish', () => {
      const latencyMs = Date.now() - startTime;
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.socket.remoteAddress;

      this.trafficLogger.logRequest({
        nodeId: node.id,
        method: req.method,
        originalPath: originalUrl,
        targetPath,
        targetPort: node.port,
        statusCode: res.statusCode,
        latencyMs,
        clientIp,
        userAgent: req.headers['user-agent'] as string,
        referer: req.headers['referer'] as string,
      });
    });

    // Transparent proxy streaming - zero body tampering, zero encoding corruption
    this.proxy.web(req, res, {
      target: targetUrl,
      headers: {
        'x-forwarded-node': node.id,
        'x-forwarded-port': String(node.port),
      },
    });
  }

  /**
   * Handle WebSocket Upgrade
   */
  handleWebSocketUpgrade(req: http.IncomingMessage, socket: any, head: any, node: NodeEntity) {
    const targetUrl = `http://127.0.0.1:${node.port}`;
    this.logger.log(`Proxying WebSocket upgrade for [${node.name}] -> localhost:${node.port}${req.url}`);
    
    this.proxy.ws(req, socket, head, {
      target: targetUrl,
      changeOrigin: true,
    });
  }
}

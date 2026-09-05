import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as httpProxy from 'http-proxy';
import { Request, Response } from 'express';
import { NodesService } from '../nodes/nodes.service';
import { TrafficLoggerService } from '../traffic/traffic-logger.service';
import { NodeEntity } from '../nodes/node.interface';
import * as http from 'http';
import * as zlib from 'zlib';

export interface ResolvedNode {
  node: NodeEntity;
  targetPath: string;
  matchedTier: 1 | 2 | 3;
  isSwitchPage?: boolean;
  switchNode?: NodeEntity;
  baseSlug?: string;
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
      selfHandleResponse: true,
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

    // Custom response interceptor for HTML subpath injection and streaming
    this.proxy.on('proxyRes', (proxyRes, req: any, res: any) => {
      this.handleProxyResponse(proxyRes, req, res);
    });

    // Safety fallback: re-stream body if it was ever parsed by an upstream middleware
    this.proxy.on('proxyReq', (proxyReq, req: any) => {
      if (req.body && !req._readableState?.flowing && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        let bodyData: string | Buffer = '';
        if (contentType.includes('application/json')) {
          bodyData = JSON.stringify(req.body);
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          bodyData = new URLSearchParams(req.body).toString();
        }
        if (bodyData) {
          proxyReq.setHeader('content-length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      }
    });
  }

  onModuleInit() {
    this.logger.log('Reverse Proxy Engine online with Instant Sanitation and Webhook Scoping.');
  }

  /**
   * Helper to parse cookie header
   */
  private parseCookies(cookieHeader: string | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    const items = cookieHeader.split(';');
    for (const item of items) {
      const [name, ...val] = item.trim().split('=');
      if (name) {
        cookies[name.trim()] = decodeURIComponent(val.join('=').trim());
      }
    }
    return cookies;
  }

  /**
   * Helper to strip internal cache-busting parameter before forwarding to local app
   */
  private cleanForwardPath(url: string): string {
    if (!url || !url.includes('__switch=')) return url || '/';
    try {
      const [p, q] = url.split('?');
      if (!q) return p || '/';
      const params = new URLSearchParams(q);
      params.delete('__switch');
      const remaining = params.toString();
      return remaining ? `${p}?${remaining}` : (p || '/');
    } catch {
      return url || '/';
    }
  }

  /**
   * Resolves which node handles this request:
   * 1. Direct Slug Match: /<node_slug> or /<node_slug>/...
   * 2. Referer Header Scoping: naked subresources (e.g. /@vite/client or /src/index.css)
   * 3. Active Cookie Match (__active_node) for Root / and all naked assets / WebSockets
   * 4. Default / Fallback: Single Active Node
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
    let firstActiveNode: NodeEntity | null = null;
    for (const node of allActiveNodes) {
      if (node.is_active) {
        if (!firstActiveNode) firstActiveNode = node;
        activeNodesMap.set(node.slug.toLowerCase(), node);
        activeNodesMap.set(node.id.toLowerCase(), node);
      }
    }

    if (activeNodesMap.size === 0) {
      return null;
    }

    const method = (req.method || 'GET').toUpperCase();
    const isSafeMethod = method === 'GET' || method === 'HEAD';
    const acceptsHtml = (req.headers?.['accept'] || '').includes('text/html');

    // =========================================================================
    // 1. Direct Slug Match: /<node_slug> or /<node_slug>/...
    // =========================================================================
    if (segments.length >= 1) {
      const candidateSlug = segments[0].toLowerCase();
      const node = activeNodesMap.get(candidateSlug);
      if (node) {
        // Case A: Browser HTML navigation to /slug or /slug/
        // Returns the Instant Sanitation & Switcher Page that wipes previous Service Workers/caches
        // and hard-replaces to / with a timestamp so modern browsers NEVER de-duplicate the navigation!
        if (isSafeMethod && acceptsHtml && segments.length === 1) {
          return {
            node,
            targetPath: '/',
            matchedTier: 1,
            isSwitchPage: true,
            switchNode: node,
            baseSlug: node.slug,
          };
        }

        // Case B: Direct Webhook, API, or deep asset request (e.g. POST /my-epic-weebhook-07 or /custom-wiki/api/data)
        // Passes directly to target port without redirect or cookie dependency!
        let targetPath = rawPath;
        if (node.strip_prefix) {
          const prefix = `/${segments[0]}`;
          targetPath = rawPath.substring(prefix.length) || '/';
          if (!targetPath.startsWith('/')) {
            targetPath = `/${targetPath}`;
          }
        }

        return {
          node,
          targetPath: this.cleanForwardPath(targetPath),
          matchedTier: 1,
          baseSlug: node.slug,
        };
      }
    }

    // =========================================================================
    // 2. Referer Header Scoping: naked subresources (e.g. /@vite/client or /src/index.css)
    // =========================================================================
    const referer = req.headers?.['referer'] || req.headers?.['referrer'];
    if (referer && typeof referer === 'string') {
      try {
        const refUrl = new URL(referer);
        const refSegments = refUrl.pathname.split('/').filter(Boolean);
        for (const seg of refSegments) {
          const matched = activeNodesMap.get(seg.toLowerCase());
          if (matched) {
            return {
              node: matched,
              targetPath: this.cleanForwardPath(rawPath),
              matchedTier: 2,
              baseSlug: matched.slug,
            };
          }
        }
      } catch {
        // Ignore invalid referer URLs
      }
    }

    // =========================================================================
    // 3. Active Cookie Match (__active_node) for Root / and all naked assets / WebSockets
    // =========================================================================
    const cookies = this.parseCookies(req.headers?.cookie);
    const activeCookie = (cookies['__active_node'] || '').toLowerCase();
    if (activeCookie && activeNodesMap.has(activeCookie)) {
      const node = activeNodesMap.get(activeCookie)!;
      return {
        node,
        targetPath: this.cleanForwardPath(rawPath),
        matchedTier: 3,
        baseSlug: node.slug,
      };
    }

    // =========================================================================
    // 4. Default / Fallback: Single Active Node
    // =========================================================================
    if (firstActiveNode) {
      return {
        node: firstActiveNode,
        targetPath: this.cleanForwardPath(rawPath),
        matchedTier: 3,
        baseSlug: firstActiveNode.slug,
      };
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
    // 1. Handle Instant Sanitation & Switcher Page for Browser UI Navigation
    if (resolved.isSwitchPage && resolved.switchNode) {
      const node = resolved.switchNode;
      res.setHeader(
        'Set-Cookie',
        `__active_node=${node.slug}; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Clear-Site-Data', '"cache"');

      return res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Routing to ${node.name}...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      background: #09090b;
      color: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      padding: 1.5rem 2.25rem;
      border-radius: 0.75rem;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #27272a;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin: 0 auto 0.85rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div style="font-weight:600; font-size: 1rem; color: #38bdf8;">Routing to ${node.name}</div>
    <div style="font-size: 0.8rem; color: #71717a; margin-top: 0.35rem; font-family: monospace;">localhost:${node.port}</div>
  </div>

  <script>
    (async function() {
      // 1. Instantly kill all rogue Service Workers from previous apps
      if ('serviceWorker' in navigator) {
        try {
          var regs = await navigator.serviceWorker.getRegistrations();
          for (var i = 0; i < regs.length; i++) {
            await regs[i].unregister();
          }
        } catch (e) {}
      }

      // 2. Clear all previous site CacheStorage to eliminate cross-app collisions
      if ('caches' in window) {
        try {
          var keys = await caches.keys();
          for (var i = 0; i < keys.length; i++) {
            await caches.delete(keys[i]);
          }
        } catch (e) {}
      }

      // 3. Set active node cookie immediately in browser
      document.cookie = "__active_node=${node.slug}; path=/; max-age=31536000; SameSite=Lax";

      // 4. Instant hard navigation to root / with timestamp (forces browser to reload without de-duplication)
      window.location.replace('/?__switch=' + Date.now());
    })();
  </script>
</body>
</html>`);
    }

    const { node, targetPath } = resolved;
    const originalUrl = req.url;

    req.url = targetPath; // Set forwarded path
    const targetUrl = `http://127.0.0.1:${node.port}`;

    // For HTML requests, request uncompressed response from local server for fast zero-overhead rewriting
    const acceptsHtml = (req.headers?.accept || '').includes('text/html');
    if (acceptsHtml) {
      delete req.headers['accept-encoding'];
    }

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

    this.proxy.web(req, res, {
      target: targetUrl,
      headers: {
        'x-forwarded-node': node.id,
        'x-forwarded-port': String(node.port),
      },
    });
  }

  /**
   * Handle proxy responses: stream media/APIs, sanitize HTML
   */
  private handleProxyResponse(proxyRes: http.IncomingMessage, req: any, res: Response) {
    if (res.headersSent) return;

    const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
    const isHtml = contentType.includes('text/html');

    // For non-HTML responses (JS, CSS, images, JSON, SSE, audio, video, etc.): direct high-speed pipe
    if (!isHtml) {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    }

    // For HTML responses: buffer, decompress if needed, inject Service Worker killer & anti-cache headers
    const chunks: Buffer[] = [];
    proxyRes.on('data', (chunk) => chunks.push(chunk));
    proxyRes.on('end', () => {
      if (res.headersSent) return;

      const bodyBuffer = Buffer.concat(chunks);
      const encoding = (proxyRes.headers['content-encoding'] || '').toLowerCase();

      let decompressed: Buffer;
      try {
        if (encoding === 'gzip') {
          decompressed = zlib.gunzipSync(bodyBuffer);
        } else if (encoding === 'deflate') {
          decompressed = zlib.inflateSync(bodyBuffer);
        } else if (encoding === 'br') {
          decompressed = zlib.brotliDecompressSync(bodyBuffer);
        } else {
          decompressed = bodyBuffer;
        }
      } catch {
        decompressed = bodyBuffer;
      }

      let html = decompressed.toString('utf-8');

      // Inject Service Worker killer into <head> so rogue workers never hijack other apps
      const swSanitizer = `
<script id="__gw_sw_sanitizer__">
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    for (var i = 0; i < regs.length; i++) {
      regs[i].unregister();
    }
  });
}
</script>
`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1\n${swSanitizer}`);
      } else {
        html = swSanitizer + html;
      }

      const modifiedBuffer = Buffer.from(html, 'utf-8');

      const outgoingHeaders: Record<string, any> = { ...proxyRes.headers };
      delete outgoingHeaders['content-length'];
      delete outgoingHeaders['content-encoding'];
      outgoingHeaders['content-type'] = 'text/html; charset=utf-8';
      outgoingHeaders['content-length'] = String(modifiedBuffer.length);
      outgoingHeaders['cache-control'] = 'no-cache, no-store, must-revalidate';
      outgoingHeaders['pragma'] = 'no-cache';
      outgoingHeaders['expires'] = '0';

      res.writeHead(proxyRes.statusCode || 200, outgoingHeaders);
      res.end(modifiedBuffer);
    });

    proxyRes.on('error', (err) => {
      this.logger.error(`Error processing HTML proxy response: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Error processing upstream response');
      }
    });
  }

  /**
   * Handle WebSocket Upgrade
   */
  handleWebSocketUpgrade(
    req: http.IncomingMessage,
    socket: any,
    head: any,
    node: NodeEntity,
    targetPath?: string,
  ) {
    if (targetPath) {
      req.url = this.cleanForwardPath(targetPath);
    }
    const targetUrl = `http://127.0.0.1:${node.port}`;
    this.logger.log(`Proxying WebSocket upgrade for [${node.name}] -> localhost:${node.port}${req.url}`);

    this.proxy.ws(req, socket, head, {
      target: targetUrl,
      changeOrigin: true,
    });
  }
}

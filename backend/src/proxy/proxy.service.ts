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
  isTrailingSlashRedirect?: boolean;
  redirectUrl?: string;
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
    const queryString = rawPath.includes('?') ? rawPath.substring(rawPath.indexOf('?')) : '';
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
        // Enforce trailing slash on bare slug for HTML browser navigation
        // e.g. /custom-wiki -> 301 to /custom-wiki/ so relative <base> resolution works
        if (isSafeMethod && acceptsHtml && segments.length === 1 && !rawPath.startsWith(`/${segments[0]}/`)) {
          return {
            node,
            targetPath: '/',
            matchedTier: 1,
            isTrailingSlashRedirect: true,
            redirectUrl: `/${segments[0]}/${queryString}`,
            baseSlug: node.slug,
          };
        }

        // Calculate forwarded targetPath
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
    // 1. Handle Trailing Slash 301 Redirect for bare slug navigation (e.g. /custom-wiki -> /custom-wiki/)
    if (resolved.isTrailingSlashRedirect && resolved.redirectUrl) {
      return res.redirect(301, resolved.redirectUrl);
    }

    const { node, targetPath, baseSlug } = resolved;
    const originalUrl = req.url;

    // Attach baseSlug to request object so handleProxyResponse knows which slug to virtualize
    (req as any).__baseSlug = baseSlug || node.slug;

    req.url = targetPath; // Set forwarded path
    const targetUrl = `http://127.0.0.1:${node.port}`;

    // Request uncompressed responses from local upstream dev servers for fast zero-overhead virtualization
    delete req.headers['accept-encoding'];

    // Set active node cookie on HTML page loads so any naked sub-requests fallback cleanly to this app
    const acceptsHtml = (req.headers?.accept || '').includes('text/html');
    if (acceptsHtml) {
      res.setHeader(
        'Set-Cookie',
        `__active_node=${node.slug}; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
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
        'x-forwarded-slug': node.slug,
      },
    });
  }

  /**
   * Handle proxy responses: on-the-fly streaming virtualization for HTML, JS, CSS
   */
  private handleProxyResponse(proxyRes: http.IncomingMessage, req: any, res: Response) {
    if (res.headersSent) return;

    const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
    const slug: string | undefined = req.__baseSlug;

    const isHtml = contentType.includes('text/html');
    const isJs =
      Boolean(slug) &&
      (contentType.includes('javascript') ||
        contentType.includes('application/x-javascript') ||
        contentType.includes('application/ecmascript') ||
        req.url.endsWith('.js') ||
        req.url.includes('.js?') ||
        req.url.includes('.jsx') ||
        req.url.includes('.ts') ||
        req.url.includes('.tsx') ||
        req.url.includes('/@vite/') ||
        req.url.includes('/@fs/') ||
        req.url.includes('/@id/'));
    const isCss =
      Boolean(slug) &&
      (contentType.includes('text/css') ||
        req.url.endsWith('.css') ||
        req.url.includes('.css?'));

    // For non-transformable responses (media, images, binary, SSE, APIs, Webhooks): direct high-speed pipe
    if (!isHtml && !isJs && !isCss) {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    }

    // Buffer and decompress response body
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

      let content = decompressed.toString('utf-8');

      // Virtualize according to content type
      if (isHtml) {
        content = slug ? this.transformHtml(content, slug) : this.injectSwSanitizerOnly(content);
      } else if (isJs && slug) {
        content = this.transformJs(content, slug);
      } else if (isCss && slug) {
        content = this.transformCss(content, slug);
      }

      const modifiedBuffer = Buffer.from(content, 'utf-8');

      const outgoingHeaders: Record<string, any> = { ...proxyRes.headers };
      delete outgoingHeaders['content-length'];
      delete outgoingHeaders['content-encoding'];
      delete outgoingHeaders['etag'];
      delete outgoingHeaders['last-modified'];

      outgoingHeaders['content-length'] = String(modifiedBuffer.length);
      outgoingHeaders['cache-control'] = 'no-cache, no-store, must-revalidate';
      outgoingHeaders['pragma'] = 'no-cache';
      outgoingHeaders['expires'] = '0';

      if (isHtml) {
        outgoingHeaders['content-type'] = 'text/html; charset=utf-8';
      } else if (isJs && !outgoingHeaders['content-type']) {
        outgoingHeaders['content-type'] = 'application/javascript; charset=utf-8';
      }

      res.writeHead(proxyRes.statusCode || 200, outgoingHeaders);
      res.end(modifiedBuffer);
    });

    proxyRes.on('error', (err) => {
      this.logger.error(`Error processing proxy response: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502);
        res.end('Error processing upstream response');
      }
    });
  }

  /**
   * Virtualize HTML for subpath: inject base tag, runtime shim, and rewrite root-absolute asset URLs
   */
  private transformHtml(html: string, slug: string): string {
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Rewrite root-absolute src and href in HTML tags (e.g. src="/src/main.tsx" -> src="/custom-wiki/src/main.tsx")
    // Ignores protocol-relative URLs (//) and paths already prefixed with /<slug>/
    const attrRegex = new RegExp(`(src|href)=["']\\/((?!\\/|${escapedSlug}\\/)[^"']*)["']`, 'gi');
    html = html.replace(attrRegex, `$1="/${slug}/$2"`);

    // 2. Inject <base href="/<slug>/"> and runtime shim + SW killer into <head>
    const shim = `
  <base href="/${slug}/">
  <script id="__gw_subpath_shim__">
    window.__GW_BASENAME__ = "/${slug}";
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        for (var i = 0; i < regs.length; i++) {
          regs[i].unregister();
        }
      }).catch(function() {});
    }
  </script>
`;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n${shim}`);
    } else {
      html = shim + html;
    }

    return html;
  }

  private injectSwSanitizerOnly(html: string): string {
    const swSanitizer = `
<script id="__gw_sw_sanitizer__">
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    for (var i = 0; i < regs.length; i++) {
      regs[i].unregister();
    }
  }).catch(function() {});
}
</script>
`;
    if (/<head[^>]*>/i.test(html)) {
      return html.replace(/(<head[^>]*>)/i, `$1\n${swSanitizer}`);
    }
    return swSanitizer + html;
  }

  /**
   * Virtualize JavaScript: rewrite static & dynamic imports, patch BrowserRouter basename, patch Vite HMR base
   */
  private transformJs(js: string, slug: string): string {
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. Static imports/exports: from "/..." -> from "/<slug>/..."
    const fromRegex = new RegExp(`(from\\s*['"])\\/((?!\\/|${escapedSlug}\\/)[^'"]*)(['"])`, 'g');
    js = js.replace(fromRegex, `$1/${slug}/$2$3`);

    // 2. Bare side-effect imports: import "/..." -> import "/<slug>/..."
    const importBareRegex = new RegExp(`(import\\s*['"])\\/((?!\\/|${escapedSlug}\\/)[^'"]*)(['"])`, 'g');
    js = js.replace(importBareRegex, `$1/${slug}/$2$3`);

    // 3. Dynamic imports: import("/...") -> import("/<slug>/...")
    const importDynamicRegex = new RegExp(`(import\\s*\\(\\s*['"])\\/((?!\\/|${escapedSlug}\\/)[^'"]*)(['"]\\s*\\))`, 'g');
    js = js.replace(importDynamicRegex, `$1/${slug}/$2$3`);

    // 4. React Router 6/7 BrowserRouter default basename injection
    js = js.replace(
      /function\s+BrowserRouter\s*\(\s*\{\s*basename\s*(?:=[^,}]+)?\s*,/g,
      `function BrowserRouter({ basename = (typeof window !== 'undefined' && window.__GW_BASENAME__) || undefined,`,
    );

    // 5. Vite HMR Client WebSocket base injection
    js = js.replace(/__HMR_BASE__\s*=\s*['"]\/['"]/g, `__HMR_BASE__ = "/${slug}/"`);
    js = js.replace(/const\s+base\s*=\s*__BASE__\s*\|\|\s*['"]\/['"]/g, `const base = __BASE__ || "/${slug}/"`);

    return js;
  }

  /**
   * Virtualize CSS: rewrite url(/...) -> url(/<slug>/...)
   */
  private transformCss(css: string, slug: string): string {
    const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cssUrlRegex = new RegExp(`url\\(\\s*(['"]?)\\/((?!\\/|${escapedSlug}\\/)[^'")]+)\\1\\s*\\)`, 'gi');
    return css.replace(cssUrlRegex, `url($1/${slug}/$2$1)`);
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

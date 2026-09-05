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
  matchedTier: 1 | 2;
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
    this.logger.log('Reverse Proxy Engine online with Deterministic Subpath Isolation.');
  }

  /**
   * Resolves which node handles this request:
   * 1. Direct Subpath Route: /<node_slug> or /<node_slug>/...
   * 2. Referer Header Scoping: naked subresources (e.g. /@vite/client or /src/index.css)
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
    // 1. Direct Subpath Route Match: /<node_slug> or /<node_slug>/...
    // =========================================================================
    if (segments.length >= 1) {
      const candidateSlug = segments[0].toLowerCase();
      const node = activeNodesMap.get(candidateSlug);
      if (node) {
        // Enforce trailing slash on bare slug ONLY for GET/HEAD browser HTML navigation
        // (e.g. browser visiting /custom-wiki -> 301 to /custom-wiki/).
        // Webhooks and APIs sending POST/PUT or asking for JSON must NEVER be redirected!
        const method = (req.method || 'GET').toUpperCase();
        const isSafeMethod = method === 'GET' || method === 'HEAD';
        const acceptsHtml = (req.headers?.['accept'] || '').includes('text/html');

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
          targetPath,
          matchedTier: 1,
          baseSlug: node.slug,
        };
      }
    }

    // =========================================================================
    // 2. Referer Header Scoping (Safety Net for un-prefixed subresources)
    // When an asset (e.g. /@vite/client or /src/index.css) is requested without prefix,
    // inspect Referer: if it came from /<node_slug>/..., route to that node!
    // =========================================================================
    const referer = req.headers?.['referer'] || req.headers?.['referrer'];
    if (referer && typeof referer === 'string') {
      try {
        const refUrl = new URL(referer);
        const refSegments = refUrl.pathname.split('/').filter(Boolean);
        if (refSegments.length >= 1) {
          const refSlug = refSegments[0].toLowerCase();
          const node = activeNodesMap.get(refSlug);
          if (node) {
            return {
              node,
              targetPath: rawPath,
              matchedTier: 2,
              baseSlug: node.slug,
            };
          }
        }
      } catch {
        // Ignore invalid referer URLs
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
    const { node, targetPath, isTrailingSlashRedirect, redirectUrl, baseSlug } = resolved;
    const originalUrl = req.url;

    // 1. Enforce trailing slash for deterministic subpath base URL
    if (isTrailingSlashRedirect && redirectUrl) {
      return res.redirect(301, redirectUrl);
    }

    (req as any).__baseSlug = baseSlug || node.slug;
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
   * Handle proxy responses: rewrite HTML with <base> and client shim, stream other media
   */
  private handleProxyResponse(proxyRes: http.IncomingMessage, req: any, res: Response) {
    if (res.headersSent) return;

    const contentType = (proxyRes.headers['content-type'] || '').toLowerCase();
    const isHtml = contentType.includes('text/html');
    const slug = req.__baseSlug || '';

    // Scope cookies to this node's subpath prefix so different nodes never overwrite each other's cookies
    const setCookie = proxyRes.headers['set-cookie'];
    if (setCookie && slug) {
      const prefix = `/${slug}`;
      const rewrittenCookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => {
        if (/Path=\//i.test(c)) {
          return c.replace(/Path=\/(?!\w)/i, `Path=${prefix}/`);
        }
        return `${c}; Path=${prefix}/`;
      });
      proxyRes.headers['set-cookie'] = rewrittenCookies;
    }

    // For non-HTML responses (JS, CSS, images, JSON, media, etc.): direct high-speed pipe
    if (!isHtml) {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
      return;
    }

    // For HTML responses: buffer, decompress if needed, rewrite root-relative paths & inject base/shim
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

      if (slug) {
        html = this.injectSubpathShim(html, slug);
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
   * Rewrites root-relative attributes in HTML and injects <base> and client shim
   */
  private injectSubpathShim(html: string, slug: string): string {
    const prefix = `/${slug}`;

    // 1. Rewrite root-relative attributes in HTML so initial script/css/img tags load from /<slug>/...
    // Matches src="/path" and href="/path" where /path is not protocol-relative (//) and not already prefixed
    const srcRegex = new RegExp(`src="/(?!/|${slug}/)`, 'gi');
    html = html.replace(srcRegex, `src="${prefix}/`);

    const hrefRegex = new RegExp(`href="/(?!/|${slug}/)`, 'gi');
    html = html.replace(hrefRegex, `href="${prefix}/`);

    const actionRegex = new RegExp(`action="/(?!/|${slug}/)`, 'gi');
    html = html.replace(actionRegex, `action="${prefix}/`);

    // 2. Prepare Base tag and Client-side Interceptor Script
    const shimScript = `
<base href="${prefix}/">
<script id="__ngrok_subpath_gateway_shim__">
(function() {
  var prefix = '${prefix}';
  window.__NGROK_BASE__ = prefix;

  // Intercept window.fetch
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch;
    window.fetch = function(resource, init) {
      if (typeof resource === 'string') {
        if (resource.startsWith('/') && !resource.startsWith(prefix) && !resource.startsWith('//')) {
          resource = prefix + resource;
        }
      } else if (resource && typeof resource.url === 'string') {
        try {
          var u = new URL(resource.url, window.location.href);
          if (u.origin === window.location.origin && u.pathname.startsWith('/') && !u.pathname.startsWith(prefix)) {
            resource = new Request(prefix + u.pathname + u.search, resource);
          }
        } catch (e) {}
      }
      return origFetch.call(this, resource, init);
    };
  }

  // Intercept XMLHttpRequest
  if (window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(prefix) && !url.startsWith('//')) {
        url = prefix + url;
      }
      return origOpen.apply(this, arguments);
    };
  }

  // Intercept WebSocket (Vite HMR, Socket.io, etc.)
  if (window.WebSocket) {
    var OrigWS = window.WebSocket;
    var ShimmedWS = function(url, protocols) {
      if (typeof url === 'string') {
        try {
          var parsed = new URL(url, window.location.href.replace(/^http/, 'ws'));
          if (parsed.host === window.location.host && parsed.pathname.startsWith('/') && !parsed.pathname.startsWith(prefix)) {
            parsed.pathname = prefix + parsed.pathname;
            url = parsed.toString();
          }
        } catch (e) {}
      }
      return arguments.length > 1 ? new OrigWS(url, protocols) : new OrigWS(url);
    };
    ShimmedWS.prototype = OrigWS.prototype;
    window.WebSocket = ShimmedWS;
  }

  // Intercept History pushState & replaceState for SPA routers (React Router, Vue Router, etc.)
  if (window.history && history.pushState) {
    var origPush = history.pushState;
    history.pushState = function(state, title, url) {
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(prefix) && !url.startsWith('//')) {
        url = prefix + url;
      }
      return origPush.call(this, state, title, url);
    };
    var origReplace = history.replaceState;
    history.replaceState = function(state, title, url) {
      if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(prefix) && !url.startsWith('//')) {
        url = prefix + url;
      }
      return origReplace.call(this, state, title, url);
    };
  }
})();
</script>
`;

    // 3. Inject right after <head> or at start of HTML
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n${shimScript}`);
    } else if (/<html[^>]*>/i.test(html)) {
      html = html.replace(/(<html[^>]*>)/i, `$1\n<head>${shimScript}</head>`);
    } else {
      html = shimScript + html;
    }

    return html;
  }

  /**
   * Handle WebSocket Upgrade
   */
  handleWebSocketUpgrade(req: http.IncomingMessage, socket: any, head: any, node: NodeEntity, targetPath?: string) {
    if (targetPath) {
      req.url = targetPath;
    }
    const targetUrl = `http://127.0.0.1:${node.port}`;
    this.logger.log(`Proxying WebSocket upgrade for [${node.name}] -> localhost:${node.port}${req.url}`);
    
    this.proxy.ws(req, socket, head, {
      target: targetUrl,
      changeOrigin: true,
    });
  }
}

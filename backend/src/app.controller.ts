import { Controller, Get, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseService } from './database/database.service';
import { NgrokService } from './ngrok/ngrok.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller()
export class AppController {
  constructor(
    private readonly db: DatabaseService,
    private readonly ngrokService: NgrokService,
  ) {}

  @Get('api/health')
  async getHealth() {
    const portStr = await this.db.getSetting('gateway_port', '7779');
    const gatewayPort = parseInt(portStr, 10) || 7779;
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      gatewayPort,
      database: this.db.getStatus(),
      ngrok: this.ngrokService.getStatus(),
    };
  }

  // Dashboard handler
  @Get(['dashboard', 'dashboard/*'])
  serveDashboard(@Req() req: Request, @Res() res: Response) {
    const frontendDist = path.resolve(__dirname, '../../frontend/dist');
    const indexPath = path.join(frontendDist, 'index.html');

    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }

    // If frontend hasn't been built yet (e.g. during initial dev)
    res.type('html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ngrok Multi-Redirect Gateway</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #18181b; border: 1px solid #27272a; padding: 2rem; border-radius: 0.5rem; max-width: 500px; text-align: center; }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #38bdf8; }
            p { color: #a1a1aa; font-size: 0.95rem; line-height: 1.5; }
            .badge { display: inline-block; background: #0284c7; color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-weight: 600; font-size: 0.85rem; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Ngrok Multi-Redirect Gateway</h1>
            <p>Gateway is running on port <strong>7779</strong>.</p>
            <p>Frontend dev server is running on <a href="http://localhost:5173" style="color:#38bdf8">http://localhost:5173</a>.</p>
            <div class="badge">NestJS Gateway Online</div>
          </div>
        </body>
      </html>
    `);
  }
}

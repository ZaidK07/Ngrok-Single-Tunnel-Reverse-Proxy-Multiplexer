export interface NodeEntity {
  id: string; // The unique Node ID / Slug used in URL (e.g. "node_1", "5000")
  name: string; // Display Name (e.g. "Storefront Web UI", "Auth API")
  port: number; // Target local port (e.g. 5000, 3000)
  slug: string; // Path identifier in URL
  description?: string;
  is_active: boolean;
  strip_prefix: boolean;
  last_health_status: 'HEALTHY' | 'UNREACHABLE' | 'UNKNOWN';
  last_health_checked_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

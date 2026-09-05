export interface NodeEntity {
  id: string; // Node ID / unique URL slug
  name: string; // Display Name
  port: number; // Target local port
  slug: string; // URL path identifier
  description?: string;
  is_active: boolean;
  strip_prefix: boolean;
  last_health_status: 'HEALTHY' | 'UNREACHABLE' | 'UNKNOWN';
  last_health_checked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RequestLog {
  id: string;
  node_id: string;
  node_name?: string;
  method: string;
  original_path: string;
  target_path: string;
  target_port: number;
  status_code: number;
  latency_ms: number;
  client_ip?: string;
  user_agent?: string;
  referer?: string;
  error_message?: string;
  created_at: string;
}

export interface NgrokStatus {
  status: 'ONLINE' | 'STOPPED' | 'ERROR';
  publicUrl: string | null;
  configuredDomain?: string;
  gatewayPort: number;
  mode: 'EXTERNAL_AGENT' | 'MANAGED' | 'NONE';
  region?: string;
  account?: string;
  errorMessage?: string;
  lastCheckedAt: string;
}

export interface TrafficStats {
  totalRequests: number;
  avgLatencyMs: number;
  totalErrors: number;
  errorRate: string;
  requests24h: number;
}

export interface SystemInfo {
  database: {
    connected: boolean;
    host: string;
    port: number;
    database: string;
    user: string;
    lastError: string | null;
  };
  gateway: {
    port: number;
    uptimeSeconds: number;
    nodeVersion: string;
    platform: string;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
    };
  };
  ngrok: {
    status: 'ONLINE' | 'STOPPED' | 'ERROR';
    publicUrl: string | null;
    mode: string;
    configuredDomain: string | null;
    hasAuthToken: boolean;
  };
  stats: {
    totalNodes: number;
    activeNodes: number;
    healthyNodes: number;
    totalLogs: number;
  };
}

export interface CreateNodePayload {
  name: string;
  port: number;
  id: string;
  description?: string;
  strip_prefix?: boolean;
}

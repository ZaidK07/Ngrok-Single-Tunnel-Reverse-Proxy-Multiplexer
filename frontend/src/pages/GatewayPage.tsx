import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Square,
  ExternalLink,
  Layers,
  Activity,
  Zap,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { NgrokStatus, TrafficStats, NodeEntity } from '../types';

interface GatewayPageProps {
  ngrokStatus: NgrokStatus | null;
  onStartNgrok: () => Promise<void>;
  onStopNgrok: () => Promise<void>;
  trafficStats: TrafficStats | null;
  nodes: NodeEntity[];
  onRefresh: () => void;
  setActiveTab: (tab: string) => void;
}

export const GatewayPage: React.FC<GatewayPageProps> = ({
  ngrokStatus,
  onStartNgrok,
  onStopNgrok,
  trafficStats,
  nodes,
  onRefresh,
  setActiveTab,
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const isOnline = ngrokStatus?.status === 'ONLINE';
  const healthyNodesCount = nodes.filter((n) => n.last_health_status === 'HEALTHY').length;

  const handleCopy = (text: string, id: string = 'base') => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggleTunnel = async () => {
    try {
      setLoadingAction(true);
      if (isOnline) {
        await onStopNgrok();
      } else {
        await onStartNgrok();
      }
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Tunnel Controller */}
      <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
        <div
          className={`h-[6px] w-full ${
            isOnline
              ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-electric-blue'
              : 'bg-gradient-to-r from-zinc-400 to-zinc-600'
          }`}
        />
        <div className="p-7 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-2.5">
              <div className="flex items-center space-x-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-tag text-xs font-semibold uppercase tracking-caption ${
                    isOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-lavender-wash dark:bg-zinc-800 text-clearbit-slate dark:text-zinc-400 border border-frost-border dark:border-zinc-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-mist'
                    }`}
                  />
                  {isOnline ? 'Ngrok Tunnel Online' : 'Ngrok Tunnel Stopped'}
                </span>

                <button
                  onClick={onRefresh}
                  className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-300 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
                  title="Refresh Status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-heading-sm text-midnight-ink dark:text-zinc-100">
                Gateway Reverse Proxy Controller
              </h2>
              <p className="text-sm text-clearbit-slate dark:text-zinc-400">
                Receives all incoming public traffic and multiplexes to target local ports.
              </p>
            </div>

            {/* Action Button */}
            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={handleToggleTunnel}
                disabled={loadingAction}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-btn text-xs font-semibold transition-all shadow-none ${
                  isOnline
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900'
                    : 'bg-cobalt-surface hover:bg-electric-blue text-white shadow-sm'
                }`}
              >
                {loadingAction ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : isOnline ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
                <span>{isOnline ? 'Stop Ngrok Tunnel' : 'Start Ngrok Tunnel'}</span>
              </button>
            </div>
          </div>

          {/* URL Box if online */}
          {isOnline && ngrokStatus?.publicUrl && (
            <div className="mt-6 pt-6 border-t border-frost-border dark:border-zinc-800">
              <div className="text-xs font-semibold text-clearbit-slate dark:text-zinc-400 uppercase tracking-caption mb-2.5">
                Primary Public Gateway URL
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1 flex items-center px-4 h-10 bg-lavender-wash/50 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-btn text-sm font-mono text-midnight-ink dark:text-zinc-100 overflow-hidden min-w-0">
                  <span className="text-electric-blue dark:text-sky-400 mr-2 font-semibold shrink-0">https://</span>
                  <span className="font-semibold select-all truncate">
                    {ngrokStatus.publicUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(ngrokStatus.publicUrl!, 'base')}
                  className="flex items-center justify-center space-x-2 px-4 h-10 text-xs font-medium bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors shrink-0"
                >
                  {copied === 'base' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Base URL</span>
                    </>
                  )}
                </button>
                <a
                  href={ngrokStatus.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center px-3 h-10 bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors shrink-0"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="mt-3 flex items-center space-x-4 text-xs text-clearbit-slate dark:text-zinc-400">
                <span>
                  Forwarding target: <strong className="font-mono text-midnight-ink dark:text-zinc-300">127.0.0.1:{ngrokStatus.gatewayPort}</strong>
                </span>
                <span>•</span>
                <span>
                  Agent mode: <strong className="text-midnight-ink dark:text-zinc-300">{ngrokStatus.mode}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats Grid - 4 Big, Roomy, Insanely Polished Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Nodes */}
        <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none min-h-[175px] flex flex-col justify-between hover:border-frost-border/80 dark:hover:border-zinc-700 transition-all">
          <div className="h-[6px] w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-indigo-600" />
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-clearbit-slate dark:text-zinc-400">
                Total Nodes
              </span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Layers className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-midnight-ink dark:text-zinc-100 tracking-tight">
                {nodes.length}
              </div>
            </div>
            <div className="text-xs text-clearbit-slate dark:text-zinc-400">
              Registered route endpoints
            </div>
          </div>
        </div>

        {/* Healthy Ports */}
        <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none min-h-[175px] flex flex-col justify-between hover:border-frost-border/80 dark:hover:border-zinc-700 transition-all">
          <div className="h-[6px] w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600" />
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-clearbit-slate dark:text-zinc-400">
                Healthy Ports
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                {healthyNodesCount} / {nodes.length}
              </div>
            </div>
            <div className="text-xs text-clearbit-slate dark:text-zinc-400">
              Local applications alive
            </div>
          </div>
        </div>

        {/* Total Requests */}
        <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none min-h-[175px] flex flex-col justify-between hover:border-frost-border/80 dark:hover:border-zinc-700 transition-all">
          <div className="h-[6px] w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-600" />
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-clearbit-slate dark:text-zinc-400">
                Total Requests
              </span>
              <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Activity className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-midnight-ink dark:text-zinc-100 tracking-tight">
                {trafficStats?.totalRequests || 0}
              </div>
            </div>
            <div className="text-xs text-clearbit-slate dark:text-zinc-400">
              Proxied through gateway
            </div>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none min-h-[175px] flex flex-col justify-between hover:border-frost-border/80 dark:hover:border-zinc-700 transition-all">
          <div className="h-[6px] w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500" />
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-clearbit-slate dark:text-zinc-400">
                Avg Latency
              </span>
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Zap className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="my-2.5">
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-midnight-ink dark:text-zinc-100 tracking-tight">
                {trafficStats?.avgLatencyMs || 0}ms
              </div>
            </div>
            <div className="text-xs text-clearbit-slate dark:text-zinc-400">
              Error rate: {trafficStats?.errorRate || '0.0%'}
            </div>
          </div>
        </div>
      </div>

      {/* Active Route Endpoints List */}
      <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
        <div className="h-[6px] w-full bg-gradient-to-r from-cobalt-surface via-electric-blue to-indigo-600" />
        <div className="px-7 py-5 border-b border-frost-border dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-midnight-ink dark:text-zinc-100">
              Active Route Endpoints ({nodes.length})
            </h3>
            <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
              Direct traffic mappings from Ngrok slug to local development ports
            </p>
          </div>
          <button
            onClick={() => setActiveTab('nodes')}
            className="text-xs font-medium text-electric-blue dark:text-sky-400 hover:underline flex items-center space-x-1"
          >
            <span>Manage Nodes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="p-12 text-center text-xs text-clearbit-slate dark:text-zinc-500">
            No route nodes configured.{' '}
            <button
              onClick={() => setActiveTab('nodes')}
              className="text-electric-blue dark:text-sky-400 font-medium hover:underline"
            >
              Add your first node
            </button>
          </div>
        ) : (
          <div className="divide-y divide-frost-border dark:divide-zinc-800 text-xs">
            {nodes.slice(0, 3).map((node) => {
              const liveUrl = isOnline && ngrokStatus?.publicUrl
                ? `${ngrokStatus.publicUrl}/${node.slug}/`
                : `/${node.slug}/`;
              const isHealthy = node.last_health_status === 'HEALTHY';

              return (
                <div
                  key={node.id}
                  className="px-7 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-lavender-wash/40 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      title={isHealthy ? 'Port is listening' : 'Port is unreachable'}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-midnight-ink dark:text-zinc-100 flex items-center space-x-2.5">
                        <span className="font-semibold text-sm">{node.name}</span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-tag bg-lavender-wash dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 text-midnight-ink dark:text-zinc-300">
                          &rarr; localhost:{node.port}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-electric-blue dark:text-sky-400 truncate mt-1 select-all">
                        {liveUrl}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {isOnline && ngrokStatus?.publicUrl && (
                      <>
                        <button
                          onClick={() => handleCopy(liveUrl, node.id)}
                          className="p-2 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
                          title="Copy Endpoint URL"
                        >
                          {copied === node.id ? (
                            <Check className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
                          title="Open Live Endpoint"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {nodes.length > 3 && (
              <div className="px-7 py-3 bg-lavender-wash/30 dark:bg-zinc-950/40 border-t border-frost-border dark:border-zinc-800 flex items-center justify-between text-xs text-clearbit-slate dark:text-zinc-400">
                <span>Showing latest 3 of {nodes.length} configured nodes</span>
                <button
                  onClick={() => setActiveTab('nodes')}
                  className="font-semibold text-electric-blue dark:text-sky-400 hover:underline flex items-center space-x-1"
                >
                  <span>View all {nodes.length} nodes &rarr;</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Setup Guide & Architecture */}
      <div className="relative overflow-hidden bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
        <div className="p-7 sm:p-8 space-y-5">
          <div>
            <h3 className="text-base font-semibold tracking-body text-midnight-ink dark:text-zinc-100">
              How Routing Works Behind 1 Ngrok Tunnel
            </h3>
            <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
              Multiplexing multiple local full-stack applications through a single HTTPS domain
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-clearbit-slate dark:text-zinc-400">
            <div className="p-5 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-card space-y-2">
              <div className="font-semibold text-midnight-ink dark:text-zinc-200 text-sm">
                1. Explicit Path Routing
              </div>
              <p className="leading-relaxed">
                When a client hits <code className="text-electric-blue dark:text-sky-400 font-mono">/node_id/api/...</code>, the gateway matches the Node ID, strips the prefix, and proxies directly to that local port.
              </p>
            </div>

            <div className="p-5 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-card space-y-2">
              <div className="font-semibold text-midnight-ink dark:text-zinc-200 text-sm">
                2. Referer Tab Isolation
              </div>
              <p className="leading-relaxed">
                Multiple browser tabs loading full React/Next/Vue UIs will never clash. Naked assets like <code className="text-electric-blue dark:text-sky-400 font-mono">/style.css</code> are scoped to their origin tab.
              </p>
            </div>

            <div className="p-5 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-card space-y-2">
              <div className="font-semibold text-midnight-ink dark:text-zinc-200 text-sm">
                3. WebSockets & SSE Tunneling
              </div>
              <p className="leading-relaxed">
                Full-duplex protocols like Socket.io, HMR, and real-time event streams are automatically upgraded and piped to the target port.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-frost-border dark:border-zinc-800">
            <span className="text-xs text-clearbit-slate dark:text-zinc-400">
              Ready to expose a local port?
            </span>
            <button
              onClick={() => setActiveTab('nodes')}
              className="text-xs font-semibold text-electric-blue dark:text-sky-400 hover:underline flex items-center space-x-1"
            >
              <span>Manage Nodes &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


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
  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const isOnline = ngrokStatus?.status === 'ONLINE';
  const healthyNodesCount = nodes.filter((n) => n.last_health_status === 'HEALTHY').length;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="space-y-6">
      {/* Top Banner / Tunnel Controller */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-6 shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
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
                className="p-1 text-mist hover:text-midnight-ink dark:hover:text-zinc-300 transition-colors"
                title="Refresh Status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-2xl font-semibold tracking-heading-sm text-midnight-ink dark:text-zinc-100">
              Gateway Reverse Proxy Controller
            </h2>
            <p className="text-xs text-clearbit-slate dark:text-zinc-400">
              Receives all incoming public traffic and multiplexes to target local ports.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleToggleTunnel}
              disabled={loadingAction}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-btn text-sm font-medium transition-all disabled:opacity-50 ${
                isOnline
                  ? 'bg-paper border border-frost-border text-rose-600 hover:bg-rose-50/50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-rose-400'
                  : 'bg-cobalt-surface hover:bg-electric-blue text-white shadow-none'
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

        {/* Public URL Box */}
        {isOnline && ngrokStatus?.publicUrl && (
          <div className="mt-6 pt-6 border-t border-frost-border dark:border-zinc-800">
            <div className="text-xs font-semibold text-clearbit-slate dark:text-zinc-400 uppercase tracking-caption mb-2">
              Primary Public Gateway URL
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center px-3.5 py-2 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-btn text-sm font-mono text-midnight-ink dark:text-zinc-100 overflow-x-auto">
                <span className="text-electric-blue dark:text-sky-400 mr-2">https://</span>
                <span className="font-semibold">
                  {ngrokStatus.publicUrl.replace(/^https?:\/\//, '')}
                </span>
              </div>
              <button
                onClick={() => handleCopy(ngrokStatus.publicUrl!)}
                className="flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-medium bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors"
              >
                {copied ? (
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
                className="flex items-center justify-center p-2.5 bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <div className="mt-2.5 flex items-center space-x-4 text-xs text-clearbit-slate dark:text-zinc-400">
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

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
          <div className="flex items-center justify-between text-clearbit-slate dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-caption">Total Nodes</span>
            <Layers className="w-4 h-4 text-mist" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-midnight-ink dark:text-zinc-100 font-mono">
            {nodes.length}
          </div>
          <div className="mt-1 text-xs text-clearbit-slate dark:text-zinc-400">
            Registered route endpoints
          </div>
        </div>

        <div className="p-5 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
          <div className="flex items-center justify-between text-clearbit-slate dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-caption">Healthy Ports</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
            {healthyNodesCount} / {nodes.length}
          </div>
          <div className="mt-1 text-xs text-clearbit-slate dark:text-zinc-400">
            Local applications alive
          </div>
        </div>

        <div className="p-5 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
          <div className="flex items-center justify-between text-clearbit-slate dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-caption">Total Requests</span>
            <Activity className="w-4 h-4 text-mist" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-midnight-ink dark:text-zinc-100 font-mono">
            {trafficStats?.totalRequests || 0}
          </div>
          <div className="mt-1 text-xs text-clearbit-slate dark:text-zinc-400">
            Proxied through gateway
          </div>
        </div>

        <div className="p-5 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none">
          <div className="flex items-center justify-between text-clearbit-slate dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-caption">Avg Latency</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-semibold text-midnight-ink dark:text-zinc-100 font-mono">
            {trafficStats?.avgLatencyMs || 0}ms
          </div>
          <div className="mt-1 text-xs text-clearbit-slate dark:text-zinc-400">
            Error rate: {trafficStats?.errorRate || '0.0%'}
          </div>
        </div>
      </div>

      {/* Quick Setup Guide & Architecture */}
      <div className="p-6 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none space-y-4">
        <h3 className="text-base font-semibold tracking-body text-midnight-ink dark:text-zinc-100">
          How Routing Works Behind 1 Ngrok Tunnel
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-clearbit-slate dark:text-zinc-400">
          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn space-y-1.5">
            <div className="font-semibold text-midnight-ink dark:text-zinc-200 text-sm">
              1. Explicit Path
            </div>
            <p>
              When a client hits <code className="text-electric-blue dark:text-sky-400">/node_id/api/...</code>, the gateway matches the Node ID, strips the prefix, and routes directly to that local port.
            </p>
          </div>

          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn space-y-1.5">
            <div className="font-semibold text-midnight-ink dark:text-zinc-200 text-sm">
              2. Referer Isolation
            </div>
            <p>
              Multiple browser tabs loading full React/Next/Vue UIs will never clash. Naked assets like <code className="text-electric-blue dark:text-sky-400">/style.css</code> are scoped to their origin tab.
            </p>
          </div>

          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn space-y-1.5">
            <div className="font-semibold text-midnight-ink dark:text-zinc-200 text-sm">
              3. WebSockets & SSE
            </div>
            <p>
              Full-duplex protocols like Socket.io, HMR, and real-time event streams are automatically upgraded and piped to the target port.
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
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
  );
};

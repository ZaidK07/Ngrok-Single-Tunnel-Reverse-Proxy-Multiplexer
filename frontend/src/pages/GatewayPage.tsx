import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Square,
  ExternalLink,
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
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Live Tunnel Banner */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-mist dark:bg-zinc-600'
              }`}
            />
            {isOnline && ngrokStatus?.publicUrl ? (
              <div className="min-w-0 flex items-center space-x-2">
                <span className="font-mono text-sm sm:text-base font-semibold text-midnight-ink dark:text-zinc-100 truncate select-all">
                  {ngrokStatus.publicUrl}
                </span>
                <button
                  onClick={() => handleCopy(ngrokStatus.publicUrl!, 'base')}
                  className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors shrink-0"
                  title="Copy URL"
                >
                  {copied === 'base' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={ngrokStatus.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors shrink-0"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : (
              <span className="font-mono text-sm text-clearbit-slate dark:text-zinc-400">
                Tunnel Offline
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onRefresh}
              className="p-2 text-mist hover:text-midnight-ink dark:text-zinc-400 dark:hover:text-zinc-200 border border-frost-border dark:border-zinc-800 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleToggleTunnel}
              disabled={loadingAction}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-btn text-xs font-medium transition-colors ${
                isOnline
                  ? 'border border-frost-border dark:border-zinc-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40 bg-paper dark:bg-zinc-900'
                  : 'bg-cobalt-surface hover:bg-electric-blue text-white shadow-none'
              }`}
            >
              {loadingAction ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : isOnline ? (
                <Square className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>{isOnline ? 'Stop Tunnel' : 'Start Tunnel'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card px-4 py-3">
          <div className="text-[11px] text-clearbit-slate dark:text-zinc-400 font-medium uppercase tracking-caption">
            Nodes
          </div>
          <div className="text-lg font-semibold font-mono text-midnight-ink dark:text-zinc-100 mt-0.5">
            {nodes.length}
          </div>
        </div>

        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card px-4 py-3">
          <div className="text-[11px] text-clearbit-slate dark:text-zinc-400 font-medium uppercase tracking-caption">
            Healthy Ports
          </div>
          <div className="text-lg font-semibold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
            {healthyNodesCount} / {nodes.length}
          </div>
        </div>

        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card px-4 py-3">
          <div className="text-[11px] text-clearbit-slate dark:text-zinc-400 font-medium uppercase tracking-caption">
            Requests
          </div>
          <div className="text-lg font-semibold font-mono text-midnight-ink dark:text-zinc-100 mt-0.5">
            {trafficStats?.totalRequests || 0}
          </div>
        </div>

        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card px-4 py-3">
          <div className="text-[11px] text-clearbit-slate dark:text-zinc-400 font-medium uppercase tracking-caption">
            Avg Latency
          </div>
          <div className="text-lg font-semibold font-mono text-midnight-ink dark:text-zinc-100 mt-0.5">
            {trafficStats?.avgLatencyMs || 0}ms
          </div>
        </div>
      </div>

      {/* Active Endpoints List */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card overflow-hidden shadow-none">
        <div className="px-4 py-3 border-b border-frost-border dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-caption text-clearbit-slate dark:text-zinc-400">
            Active Routes ({nodes.length})
          </span>
          <button
            onClick={() => setActiveTab('nodes')}
            className="text-xs font-medium text-electric-blue dark:text-sky-400 hover:underline"
          >
            Manage Nodes &rarr;
          </button>
        </div>

        {nodes.length === 0 ? (
          <div className="p-8 text-center text-xs text-clearbit-slate dark:text-zinc-500">
            No route nodes configured.{' '}
            <button
              onClick={() => setActiveTab('nodes')}
              className="text-electric-blue dark:text-sky-400 font-medium hover:underline"
            >
              Add your first node
            </button>
          </div>
        ) : (
          <div className="divide-y divide-frost-border dark:divide-zinc-800 text-xs font-mono">
            {nodes.map((node) => {
              const liveUrl = isOnline && ngrokStatus?.publicUrl
                ? `${ngrokStatus.publicUrl}/${node.slug}`
                : `/${node.slug}`;
              const isHealthy = node.last_health_status === 'HEALTHY';

              return (
                <div
                  key={node.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-lavender-wash/30 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      title={isHealthy ? 'Port is listening' : 'Port is unreachable'}
                    />
                    <div className="min-w-0">
                      <div className="font-sans font-medium text-midnight-ink dark:text-zinc-100 flex items-center space-x-2">
                        <span>{node.name}</span>
                        <span className="font-mono text-[11px] text-clearbit-slate dark:text-zinc-400 font-normal">
                          localhost:{node.port}
                        </span>
                      </div>
                      <div className="text-[11px] text-electric-blue dark:text-sky-400 truncate mt-0.5">
                        {liveUrl}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {isOnline && ngrokStatus?.publicUrl && (
                      <>
                        <button
                          onClick={() => handleCopy(liveUrl, node.id)}
                          className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
                          title="Copy Endpoint URL"
                        >
                          {copied === node.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
                          title="Open Live Endpoint"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

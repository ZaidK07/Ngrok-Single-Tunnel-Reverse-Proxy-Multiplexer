import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Power,
  RefreshCw,
  Search,
  Eye,
} from 'lucide-react';
import { NodeEntity, RequestLog, NgrokStatus } from '../types';
import { getNodeLogs, pingNode } from '../services/api';
import { RequestDetailsModal } from '../components/RequestDetailsModal';
import { formatStatusLabel } from '../utils/statusHelper';
import { formatLocalTime } from '../utils/timeHelper';

interface NodeDetailPageProps {
  nodeId: string;
  nodes: NodeEntity[];
  ngrokStatus: NgrokStatus | null;
  onBack: () => void;
  onToggleActive: (id: string, current: boolean) => Promise<void>;
}

export const NodeDetailPage: React.FC<NodeDetailPageProps> = ({
  nodeId,
  nodes,
  ngrokStatus,
  onBack,
  onToggleActive,
}) => {
  const node = nodes.find((n) => n.id === nodeId);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ status: string; latencyMs: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [availableStatuses, setAvailableStatuses] = useState<number[]>([]);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  const baseNgrokUrl =
    ngrokStatus?.publicUrl || 'https://unsmooth-jacklyn-unawakening.ngrok-free.dev';
  const liveUrl = node ? `${baseNgrokUrl}/${node.slug}` : '';

  const fetchLogs = useCallback(async () => {
    if (!nodeId) return;
    try {
      setLoadingLogs(true);
      const data = await getNodeLogs(nodeId, {
        page,
        limit: 50,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      });
      setLogs(data.logs || []);
      if (data.availableStatuses && Array.isArray(data.availableStatuses)) {
        setAvailableStatuses(data.availableStatuses);
      }
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
    } catch (err) {
      // Handled
    } finally {
      setLoadingLogs(false);
    }
  }, [nodeId, page, searchTerm, statusFilter]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<number>(availableStatuses);
    logs.forEach((log) => {
      if (log.status_code) set.add(log.status_code);
    });
    if (statusFilter) {
      const parsed = parseInt(statusFilter, 10);
      if (!isNaN(parsed)) set.add(parsed);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [availableStatuses, logs, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!node) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-clearbit-slate dark:text-zinc-400">Node not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 text-xs font-medium bg-cobalt-surface hover:bg-electric-blue text-white rounded-btn shadow-none"
        >
          &larr; Back to Nodes
        </button>
      </div>
    );
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualPing = async () => {
    try {
      setPinging(true);
      const result = await pingNode(node.id);
      setPingResult(result);
    } finally {
      setPinging(false);
    }
  };

  const isHealthy =
    pingResult?.status === 'HEALTHY' ||
    (!pingResult && node.last_health_status === 'HEALTHY');

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-2 text-xs font-medium text-clearbit-slate dark:text-zinc-400 hover:text-midnight-ink dark:hover:text-zinc-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Nodes List</span>
      </button>

      {/* Node Profile Card */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-6 shadow-none space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-semibold tracking-heading-sm text-midnight-ink dark:text-zinc-100">
                {node.name}
              </h2>
              <span
                className={`px-3 py-1 rounded-tag text-[11px] font-semibold border ${
                  node.is_active
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-lavender-wash dark:bg-zinc-800 text-clearbit-slate dark:text-zinc-400 border-frost-border dark:border-zinc-700'
                }`}
              >
                {node.is_active ? 'ACTIVE' : 'PAUSED'}
              </span>
            </div>
            <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-1">
              {node.description || 'No description provided.'}
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleManualPing}
              disabled={pinging}
              className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pinging ? 'animate-spin' : ''}`} />
              <span>{pinging ? 'Pinging...' : 'Ping Port'}</span>
            </button>

            <button
              onClick={() => onToggleActive(node.id, node.is_active)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-medium rounded-btn transition-colors ${
                node.is_active
                  ? 'bg-paper border border-frost-border text-clearbit-slate hover:bg-lavender-wash dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                  : 'bg-cobalt-surface hover:bg-electric-blue text-white shadow-none'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{node.is_active ? 'Pause Node' : 'Activate Node'}</span>
            </button>
          </div>
        </div>

        {/* Live URL */}
        <div className="pt-6 border-t border-frost-border dark:border-zinc-800">
          <div className="text-xs font-semibold text-clearbit-slate dark:text-zinc-400 uppercase tracking-caption mb-2">
            Public Endpoint
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 px-3.5 py-2 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-btn text-sm font-mono text-midnight-ink dark:text-zinc-100 select-all break-all sm:break-normal">
              {liveUrl}
            </div>
            <button
              onClick={() => handleCopy(liveUrl)}
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
                  <span>Copy URL</span>
                </>
              )}
            </button>
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center p-2.5 bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors"
              title="Open Live URL"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Node Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
            <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Node ID / URL Slug</div>
            <div className="font-mono font-bold text-midnight-ink dark:text-zinc-100 text-sm mt-1">
              /{node.slug}
            </div>
          </div>

          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
            <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Local Forward Target</div>
            <div className="font-mono font-bold text-midnight-ink dark:text-zinc-100 text-sm mt-1 flex items-center space-x-2">
              <span
                className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}
              />
              <span>localhost:{node.port}</span>
              {pingResult && (
                <span className="text-[10px] text-clearbit-slate font-normal">
                  ({pingResult.latencyMs}ms)
                </span>
              )}
            </div>
          </div>

          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
            <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Prefix Rewriting</div>
            <div className="font-semibold text-midnight-ink dark:text-zinc-100 text-sm mt-1">
              {node.strip_prefix ? 'Stripped (Recommended)' : 'Preserved'}
            </div>
          </div>

          <div className="p-4 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
            <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Total Recorded Requests</div>
            <div className="font-mono font-bold text-midnight-ink dark:text-zinc-100 text-sm mt-1">
              {pagination.total}
            </div>
          </div>
        </div>
      </div>

      {/* Node Request History Section */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-6 shadow-none space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-body text-midnight-ink dark:text-zinc-100">
              Request History for {node.name}
            </h3>
            <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
              Detailed log of all HTTP/WebSocket requests piped to port {node.port}
            </p>
          </div>

          {/* Filter Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
              <input
                type="text"
                placeholder="Search path..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 text-xs bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue cursor-pointer"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((code) => (
                <option key={code} value={code.toString()}>
                  {formatStatusLabel(code)}
                </option>
              ))}
            </select>

            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="p-1.5 text-clearbit-slate hover:text-midnight-ink dark:text-zinc-400 dark:hover:text-zinc-200 border border-frost-border dark:border-zinc-700 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Requests Table */}
        {logs.length === 0 ? (
          <div className="text-center py-12 text-clearbit-slate text-xs">
            {loadingLogs ? 'Loading requests...' : 'No request logs recorded for this node yet.'}
          </div>
        ) : (
          <div className="border border-frost-border dark:border-zinc-800 rounded-card overflow-hidden shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-lavender-wash/70 dark:bg-zinc-950 border-b border-frost-border dark:border-zinc-800 text-clearbit-slate dark:text-zinc-400 font-semibold uppercase tracking-caption">
                  <tr>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Path Forwarded</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">Client IP</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Time</th>
                    <th className="py-2.5 px-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-frost-border dark:divide-zinc-800 font-mono text-midnight-ink dark:text-zinc-300">
                  {logs.map((log) => {
                    const isSuccess = log.status_code < 400;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-lavender-wash/40 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isSuccess
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                            }`}
                          >
                            {log.status_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-midnight-ink dark:text-zinc-100">
                          {log.method}
                        </td>
                        <td className="py-2.5 px-3 text-clearbit-slate dark:text-zinc-200 truncate max-w-xs font-normal">
                          {log.target_path}
                        </td>
                        <td className="py-2.5 px-3 text-clearbit-slate dark:text-zinc-400">
                          {log.latency_ms}ms
                        </td>
                        <td className="py-2.5 px-3 text-clearbit-slate dark:text-zinc-400">
                          {log.client_ip || '127.0.0.1'}
                        </td>
                        <td className="py-2.5 px-3 text-clearbit-slate dark:text-zinc-400 font-mono text-xs whitespace-nowrap">
                          {formatLocalTime(log.created_at)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="p-1 text-mist hover:text-electric-blue dark:text-zinc-500 dark:hover:text-sky-400"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-lavender-wash/40 dark:bg-zinc-950 border-t border-frost-border dark:border-zinc-800 text-xs text-clearbit-slate dark:text-zinc-400 font-sans">
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-paper dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 disabled:opacity-40 hover:bg-lavender-wash transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-2.5 py-1 bg-paper dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 disabled:opacity-40 hover:bg-lavender-wash transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Details Modal */}
      <RequestDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};

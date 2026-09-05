import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Trash2,
  Filter,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { RequestLog, NodeEntity } from '../types';
import { getTrafficLogs, clearTrafficLogs, getConfigSettings, updateConfigSettings } from '../services/api';
import { RequestDetailsModal } from '../components/RequestDetailsModal';
import { Toggle } from '../components/Toggle';
import { formatStatusLabel } from '../utils/statusHelper';

interface TrafficPageProps {
  nodes: NodeEntity[];
}

export const TrafficPage: React.FC<TrafficPageProps> = ({ nodes }) => {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [nodeFilter, setNodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(3);
  const [availableStatuses, setAvailableStatuses] = useState<number[]>([]);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  // Fetch refresh preferences from database on mount (no localStorage)
  useEffect(() => {
    getConfigSettings()
      .then((cfg) => {
        if (typeof cfg?.traffic_refresh_interval === 'number' && cfg.traffic_refresh_interval > 0) {
          setRefreshInterval(cfg.traffic_refresh_interval);
        }
        if (typeof cfg?.traffic_auto_refresh === 'boolean') {
          setAutoRefresh(cfg.traffic_auto_refresh);
        }
      })
      .catch(() => {});
  }, []);

  const handleAutoRefreshChange = (val: boolean) => {
    setAutoRefresh(val);
    updateConfigSettings({ traffic_auto_refresh: val }).catch(() => {});
  };

  const handleIntervalChange = (val: number) => {
    setRefreshInterval(val);
    updateConfigSettings({ traffic_refresh_interval: val }).catch(() => {});
  };

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTrafficLogs({
        page,
        limit: 50,
        search: searchTerm || undefined,
        nodeId: nodeFilter || undefined,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
      });
      setLogs(data.logs || []);
      if (data.availableStatuses && Array.isArray(data.availableStatuses)) {
        setAvailableStatuses(data.availableStatuses);
      }
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, nodeFilter, statusFilter, methodFilter]);

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

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchLogs]);

  const handleClearLogs = async (days?: number) => {
    const confirmText = days
      ? `Are you sure you want to clear request logs older than ${days} days?`
      : 'Are you sure you want to purge all recorded request logs?';
    if (!window.confirm(confirmText)) return;

    await clearTrafficLogs(days);
    await fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Live Traffic Inspector
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Real-time feed of all incoming HTTP & WebSocket requests across all nodes
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Auto refresh toggle & interval selector */}
          <div className="flex items-center space-x-2.5 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <Toggle
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
              label="Auto Refresh"
            />
            <div className="h-3.5 w-px bg-slate-300 dark:bg-zinc-700" />
            <select
              value={refreshInterval}
              disabled={!autoRefresh}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-zinc-300 focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed pr-0.5"
              title="Select refresh rate"
            >
              <option value={1} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">1s</option>
              <option value={2} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">2s</option>
              <option value={3} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">3s</option>
              <option value={5} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">5s</option>
              <option value={10} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100">10s</option>
            </select>
          </div>

          <button
            onClick={() => handleClearLogs()}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 border border-slate-300 dark:border-zinc-700 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search path, URL, error..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          {/* Node Filter */}
          <select
            value={nodeFilter}
            onChange={(e) => {
              setNodeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">All Nodes</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} (:{n.port})
              </option>
            ))}
          </select>

          {/* Method Filter */}
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((code) => (
              <option key={code} value={code.toString()}>
                {formatStatusLabel(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg">
          <Activity className="w-10 h-10 mx-auto text-slate-400 dark:text-zinc-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            No traffic recorded yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mt-1">
            Send an HTTP request or webhook to your Ngrok live block URL to see live requests appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Node Target</th>
                  <th className="py-3 px-4">Original Path</th>
                  <th className="py-3 px-4">Forwarded Target</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 font-mono text-slate-700 dark:text-zinc-300">
                {logs.map((log) => {
                  const isSuccess = log.status_code < 400;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {log.status_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-zinc-100">
                        {log.method}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-sans font-semibold text-slate-900 dark:text-zinc-100">
                          {log.node_name || log.node_id}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1.5">
                          (:{log.target_port})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 dark:text-zinc-200 truncate max-w-xs font-normal">
                        {log.original_path}
                      </td>
                      <td className="py-3 px-4 text-sky-600 dark:text-sky-400 truncate max-w-xs font-normal">
                        {log.target_path}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">
                        {log.latency_ms}ms
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-zinc-400 font-sans text-[11px]">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
                          title="View Request Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
              </span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-lg disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      <RequestDetailsModal
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};

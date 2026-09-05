import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { RequestLog, NodeEntity } from '../types';
import { getTrafficLogs, clearTrafficLogs, getConfigSettings, updateConfigSettings } from '../services/api';
import { RequestDetailsModal } from '../components/RequestDetailsModal';
import { Toggle } from '../components/Toggle';
import { formatStatusLabel } from '../utils/statusHelper';
import { formatLocalTime } from '../utils/timeHelper';

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
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('records_per_page');
      return saved ? parseInt(saved, 10) || 50 : 50;
    } catch {
      return 50;
    }
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(3);
  const [availableStatuses, setAvailableStatuses] = useState<number[]>([]);
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    try {
      localStorage.setItem('records_per_page', String(newSize));
    } catch {}
    setPage(1);
  };

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
        limit: pageSize,
        search: searchTerm || undefined,
        nodeId: nodeFilter || undefined,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
      });
      setLogs(data.logs || []);
      if (data.availableStatuses && Array.isArray(data.availableStatuses)) {
        setAvailableStatuses(data.availableStatuses);
      }
      setPagination(data.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 1 });
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, nodeFilter, statusFilter, methodFilter]);

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
          <h2 className="text-2xl font-semibold tracking-heading-sm text-midnight-ink dark:text-zinc-100">
            Live Traffic Inspector
          </h2>
          <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
            Real-time feed of all incoming HTTP & WebSocket requests across all nodes
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Auto refresh toggle & interval selector */}
          <div className="inline-flex items-center space-x-2.5 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-btn px-3 h-9 shadow-none">
            <Toggle
              checked={autoRefresh}
              onChange={handleAutoRefreshChange}
              label="Auto Refresh"
            />
            <div className="h-4 w-px bg-frost-border dark:bg-zinc-700" />
            <div className={`relative inline-flex items-center ${!autoRefresh ? 'opacity-40 pointer-events-none' : ''}`}>
              <select
                value={refreshInterval}
                disabled={!autoRefresh}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="appearance-none bg-transparent text-xs font-mono font-semibold text-midnight-ink dark:text-zinc-200 pr-4 py-0.5 focus:outline-none cursor-pointer leading-none"
                title="Select refresh rate"
              >
                <option value={1} className="bg-paper dark:bg-zinc-900 text-midnight-ink dark:text-zinc-100">1s</option>
                <option value={2} className="bg-paper dark:bg-zinc-900 text-midnight-ink dark:text-zinc-100">2s</option>
                <option value={3} className="bg-paper dark:bg-zinc-900 text-midnight-ink dark:text-zinc-100">3s</option>
                <option value={5} className="bg-paper dark:bg-zinc-900 text-midnight-ink dark:text-zinc-100">5s</option>
                <option value={10} className="bg-paper dark:bg-zinc-900 text-midnight-ink dark:text-zinc-100">10s</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-mist dark:text-zinc-400 absolute right-0 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={() => handleClearLogs()}
            className="inline-flex items-center justify-center space-x-1.5 px-3 h-9 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40 border border-frost-border dark:border-zinc-800 rounded-btn transition-colors"
            title="Clear all logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center justify-center h-9 w-9 text-clearbit-slate hover:text-midnight-ink dark:text-zinc-400 dark:hover:text-zinc-200 border border-frost-border dark:border-zinc-800 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-4 shadow-none space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
            <input
              type="text"
              placeholder="Search path, URL, error..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
            />
          </div>

          {/* Node Filter */}
          <select
            value={nodeFilter}
            onChange={(e) => {
              setNodeFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue cursor-pointer"
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
            className="px-3 py-2 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue cursor-pointer"
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
            className="px-3 py-2 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue cursor-pointer"
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
        <div className="text-center py-16 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card">
          <Activity className="w-10 h-10 mx-auto text-mist dark:text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-midnight-ink dark:text-zinc-100">
            No traffic recorded yet
          </h3>
          <p className="text-xs text-clearbit-slate dark:text-zinc-400 max-w-sm mx-auto mt-1">
            Send an HTTP request or webhook to your Ngrok live block URL to see live requests appear here.
          </p>
        </div>
      ) : (
        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card overflow-hidden shadow-none">
          <div className="w-full overflow-hidden">
            <table className="w-full text-left text-xs table-fixed">
              <thead className="bg-lavender-wash/70 dark:bg-zinc-950 border-b border-frost-border dark:border-zinc-800 text-clearbit-slate dark:text-zinc-400 font-semibold uppercase tracking-caption">
                <tr>
                  <th className="py-3 px-3 w-16">Status</th>
                  <th className="py-3 px-3 w-16">Method</th>
                  <th className="py-3 px-3 w-32">Node Target</th>
                  <th className="py-3 px-3">Original Path</th>
                  <th className="py-3 px-3">Forwarded Target</th>
                  <th className="py-3 px-3 w-16">Latency</th>
                  <th className="py-3 px-3 w-24 whitespace-nowrap">Time</th>
                  <th className="py-3 px-3 w-12 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-frost-border dark:divide-zinc-800 font-mono text-midnight-ink dark:text-zinc-300">
                {logs.map((log) => {
                  const isSuccess = log.status_code < 400;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-lavender-wash/40 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
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
                      <td className="py-3 px-3 font-bold text-midnight-ink dark:text-zinc-100">
                        {log.method}
                      </td>
                      <td className="py-3 px-3">
                        <div className="truncate" title={`${log.node_name || log.node_id} (:${log.target_port})`}>
                          <span className="font-sans font-medium text-midnight-ink dark:text-zinc-100">
                            {log.node_name || log.node_id}
                          </span>
                          <span className="text-[10px] text-clearbit-slate dark:text-zinc-400 ml-1">
                            (:{log.target_port})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-clearbit-slate dark:text-zinc-200 truncate font-normal" title={log.original_path}>
                        {log.original_path}
                      </td>
                      <td className="py-3 px-3 text-electric-blue dark:text-sky-400 truncate font-normal" title={log.target_path}>
                        {log.target_path}
                      </td>
                      <td className="py-3 px-3 text-clearbit-slate dark:text-zinc-400 whitespace-nowrap">
                        {log.latency_ms}ms
                      </td>
                      <td className="py-3 px-3 text-clearbit-slate dark:text-zinc-400 font-mono text-xs whitespace-nowrap">
                        {formatLocalTime(log.created_at)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="p-1 text-mist hover:text-electric-blue dark:text-zinc-500 dark:hover:text-sky-400"
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-lavender-wash/40 dark:bg-zinc-950 border-t border-frost-border dark:border-zinc-800 text-xs text-clearbit-slate dark:text-zinc-400 font-sans">
            <div>
              {pagination.total > 0 ? (
                <span>
                  Page <strong className="text-midnight-ink dark:text-zinc-200">{pagination.page}</strong> of{' '}
                  <strong className="text-midnight-ink dark:text-zinc-200">{pagination.totalPages}</strong> ({pagination.total} records)
                </span>
              ) : (
                <span>0 records</span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <div className="inline-flex items-center space-x-2">
                <span className="text-clearbit-slate/80 dark:text-zinc-400 text-xs">Records per page:</span>
                <div className="relative inline-flex items-center">
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="appearance-none bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-700 rounded-btn text-xs font-semibold text-midnight-ink dark:text-zinc-200 pl-2.5 pr-7 h-7 focus:outline-none cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-mist dark:text-zinc-400 absolute right-1.5 pointer-events-none" />
                </div>
              </div>

              <div className="h-4 w-px bg-frost-border dark:bg-zinc-700" />

              <div className="flex items-center space-x-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 h-7 bg-paper dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-lavender-wash dark:hover:bg-zinc-700 transition-colors flex items-center justify-center font-medium"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 h-7 bg-paper dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-lavender-wash dark:hover:bg-zinc-700 transition-colors flex items-center justify-center font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
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

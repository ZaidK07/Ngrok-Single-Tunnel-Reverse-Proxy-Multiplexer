import React from 'react';
import { X, ArrowRight, ShieldAlert } from 'lucide-react';
import { RequestLog } from '../types';
import { formatLocalDateTime } from '../utils/timeHelper';

interface RequestDetailsModalProps {
  log: RequestLog | null;
  onClose: () => void;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  const isSuccess = log.status_code < 400;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight-ink/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-frost-border dark:border-zinc-800">
          <div className="flex items-center space-x-3">
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-tag font-mono ${
                isSuccess
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
              }`}
            >
              {log.status_code}
            </span>
            <span className="font-mono font-bold text-sm text-midnight-ink dark:text-zinc-100">
              {log.method}
            </span>
            <span className="text-xs text-clearbit-slate dark:text-zinc-400">
              {log.latency_ms}ms
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-btn text-clearbit-slate hover:text-midnight-ink dark:hover:text-zinc-200 hover:bg-lavender-wash dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Path Forwarding Flow */}
          <div className="p-4 bg-lavender-wash/50 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
            <div className="text-xs font-semibold text-clearbit-slate dark:text-zinc-400 uppercase tracking-caption mb-2">
              Routing Flow
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 text-sm font-mono">
              <div className="px-3 py-1.5 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 break-all">
                {log.original_path}
              </div>
              <ArrowRight className="w-4 h-4 text-mist shrink-0 hidden sm:block" />
              <div className="px-3 py-1.5 bg-cobalt-surface/10 dark:bg-sky-950/40 border border-cobalt-surface/30 dark:border-sky-800 rounded-btn text-cobalt-surface dark:text-sky-300 break-all">
                http://localhost:{log.target_port}{log.target_path}
              </div>
            </div>
          </div>

          {/* Error message alert if any */}
          {log.error_message && (
            <div className="p-4 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-btn text-rose-800 dark:text-rose-300">
              <div className="flex items-center space-x-2 font-semibold text-xs uppercase tracking-caption mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Gateway Diagnostic</span>
              </div>
              <p className="text-xs font-mono">{log.error_message}</p>
            </div>
          )}

          {/* Key Metadata Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
              <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Node ID</div>
              <div className="font-mono font-bold text-midnight-ink dark:text-zinc-100 mt-1">
                {log.node_id}
              </div>
            </div>

            <div className="p-3 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
              <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Target Port</div>
              <div className="font-mono font-bold text-midnight-ink dark:text-zinc-100 mt-1">
                localhost:{log.target_port}
              </div>
            </div>

            <div className="p-3 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
              <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Client IP</div>
              <div className="font-mono font-bold text-midnight-ink dark:text-zinc-100 mt-1">
                {log.client_ip || '127.0.0.1'}
              </div>
            </div>

            <div className="p-3 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn">
              <div className="text-clearbit-slate dark:text-zinc-400 font-medium">Timestamp (Local)</div>
              <div className="font-mono font-semibold text-midnight-ink dark:text-zinc-100 mt-1">
                {formatLocalDateTime(log.created_at)}
              </div>
            </div>
          </div>

          {/* Referer Header */}
          {log.referer && (
            <div>
              <div className="text-xs font-semibold text-clearbit-slate dark:text-zinc-400 uppercase tracking-caption mb-1">
                Referer Header (Tier 2 Tab Scoping)
              </div>
              <div className="p-3 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn text-xs font-mono text-midnight-ink dark:text-zinc-300 break-all">
                {log.referer}
              </div>
            </div>
          )}

          {/* User Agent */}
          {log.user_agent && (
            <div>
              <div className="text-xs font-semibold text-clearbit-slate dark:text-zinc-400 uppercase tracking-caption mb-1">
                User Agent
              </div>
              <div className="p-3 bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-800 rounded-btn text-xs font-mono text-clearbit-slate dark:text-zinc-300 break-all">
                {log.user_agent}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-frost-border dark:border-zinc-800 flex justify-end bg-lavender-wash/20 dark:bg-zinc-950">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-midnight-ink dark:text-zinc-300 bg-paper dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 hover:bg-lavender-wash dark:hover:bg-zinc-700 rounded-btn transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

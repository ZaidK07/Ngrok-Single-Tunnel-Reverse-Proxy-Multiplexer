import React from 'react';
import { X, Clock, Globe, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { RequestLog } from '../types';

interface RequestDetailsModalProps {
  log: RequestLog | null;
  onClose: () => void;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({ log, onClose }) => {
  if (!log) return null;

  const isSuccess = log.status_code < 400;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
          <div className="flex items-center space-x-3">
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded-md font-mono ${
                isSuccess
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
              }`}
            >
              {log.status_code}
            </span>
            <span className="font-mono font-bold text-sm text-slate-800 dark:text-zinc-200">
              {log.method}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              {log.latency_ms}ms
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Path Forwarding Flow */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
            <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Routing Flow
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 text-sm font-mono">
              <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-800 dark:text-zinc-200 break-all">
                {log.original_path}
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
              <div className="px-3 py-1.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg text-sky-700 dark:text-sky-300 break-all">
                http://localhost:{log.target_port}{log.target_path}
              </div>
            </div>
          </div>

          {/* Error message alert if any */}
          {log.error_message && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300">
              <div className="flex items-center space-x-2 font-bold text-xs uppercase tracking-wider mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Gateway Error Diagnostic</span>
              </div>
              <p className="text-xs font-mono">{log.error_message}</p>
            </div>
          )}

          {/* Key Metadata Table */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
              <div className="text-slate-500 dark:text-zinc-400 font-medium">Node ID</div>
              <div className="font-mono font-bold text-slate-800 dark:text-zinc-200 mt-1">
                {log.node_id}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
              <div className="text-slate-500 dark:text-zinc-400 font-medium">Target Port</div>
              <div className="font-mono font-bold text-slate-800 dark:text-zinc-200 mt-1">
                localhost:{log.target_port}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
              <div className="text-slate-500 dark:text-zinc-400 font-medium">Client IP</div>
              <div className="font-mono font-bold text-slate-800 dark:text-zinc-200 mt-1">
                {log.client_ip || '127.0.0.1'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg">
              <div className="text-slate-500 dark:text-zinc-400 font-medium">Timestamp</div>
              <div className="font-mono text-slate-800 dark:text-zinc-200 mt-1">
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Referer Header */}
          {log.referer && (
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                Referer Header (Tier 2 Tab Scoping)
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-slate-700 dark:text-zinc-300 break-all">
                {log.referer}
              </div>
            </div>
          )}

          {/* User Agent */}
          {log.user_agent && (
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                User Agent
              </div>
              <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-slate-700 dark:text-zinc-300 break-all">
                {log.user_agent}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end bg-slate-50 dark:bg-zinc-950">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

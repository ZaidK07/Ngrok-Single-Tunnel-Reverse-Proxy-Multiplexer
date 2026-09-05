import React, { useState, useEffect } from 'react';
import {
  Database,
  Radio,
  Server,
  RefreshCw,
  Trash2,
  Save,
  Sliders,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SystemInfo } from '../types';
import {
  getSystemInfo,
  clearTrafficLogs,
  getConfigSettings,
  updateConfigSettings,
} from '../services/api';

export const SettingsPage: React.FC = () => {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  // Editable credentials in DB
  const [authToken, setAuthToken] = useState('');
  const [staticDomain, setStaticDomain] = useState('');
  const [gatewayPort, setGatewayPort] = useState('7779');
  const [showToken, setShowToken] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  const fetchInfo = async () => {
    try {
      setLoading(true);
      const [sysInfo, config] = await Promise.all([
        getSystemInfo(),
        getConfigSettings(),
      ]);
      setInfo(sysInfo);
      if (config) {
        setAuthToken(config.ngrok_authtoken || '');
        setStaticDomain(config.ngrok_domain || '');
        setGatewayPort(String(config.gateway_port || '7779'));
      }
    } catch (err) {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      await updateConfigSettings({
        ngrok_authtoken: authToken,
        ngrok_domain: staticDomain,
        gateway_port: gatewayPort,
      });
      setConfigSuccess(true);
      fetchInfo();
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSavingConfig(false);
    }
  };

  const handlePruneLogs = async (days: number) => {
    if (!window.confirm(`Clear logs older than ${days} days?`)) return;
    try {
      setCleaning(true);
      const res = await clearTrafficLogs(days);
      setCleanMessage(res.message);
      fetchInfo();
      setTimeout(() => setCleanMessage(null), 3000);
    } finally {
      setCleaning(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const formatBytes = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-heading-sm text-midnight-ink dark:text-zinc-100">
            System & Database Settings
          </h2>
          <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
            Manage credentials directly in SQLite, monitor infrastructure, and configure the gateway
          </p>
        </div>

        <button
          onClick={fetchInfo}
          disabled={loading}
          className="p-2 text-clearbit-slate hover:text-midnight-ink dark:text-zinc-400 dark:hover:text-zinc-200 border border-frost-border dark:border-zinc-700 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
          title="Refresh Settings"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {cleanMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-btn text-xs font-semibold text-emerald-800 dark:text-emerald-400">
          {cleanMessage}
        </div>
      )}

      {/* Editable Credentials Card (Stored in Database) */}
      <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-6 shadow-none space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-electric-blue dark:text-sky-400" />
            <div>
              <h3 className="text-sm font-semibold text-midnight-ink dark:text-zinc-100">
                Database-Backed Gateway & Ngrok Credentials
              </h3>
              <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
                Saved directly to SQLite <code className="text-electric-blue dark:text-sky-400">gateway_settings</code> table &mdash; zero plain-text files in repository
              </p>
            </div>
          </div>
          {configSuccess && (
            <div className="flex items-center space-x-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              <span>Saved to Database!</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ngrok Auth Token */}
            <div>
              <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption mb-1">
                Ngrok Auth Token
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Paste your ngrok auth token..."
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full px-3.5 py-2 pr-10 text-xs font-mono bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist hover:text-midnight-ink dark:hover:text-zinc-300"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-clearbit-slate dark:text-zinc-400">
                Used to authenticate tunnels when starting from the dashboard
              </p>
            </div>

            {/* Static Domain */}
            <div>
              <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption mb-1">
                Ngrok Static / Custom Domain
              </label>
              <input
                type="text"
                placeholder="e.g. unsmooth-jacklyn-unawakening.ngrok-free.dev"
                value={staticDomain}
                onChange={(e) => setStaticDomain(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-mono bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
              />
              <p className="mt-1 text-[11px] text-clearbit-slate dark:text-zinc-400">
                Leave empty for an ephemeral dynamic ngrok domain
              </p>
            </div>
          </div>

          {/* Gateway Port */}
          <div className="w-full sm:w-1/2">
            <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption mb-1.5">
              Gateway Port
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={gatewayPort}
              onChange={(e) => setGatewayPort(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-3.5 py-2 text-xs font-mono bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="flex items-center space-x-2 px-4 py-2 bg-cobalt-surface hover:bg-electric-blue text-white text-xs font-medium rounded-btn shadow-none transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingConfig ? 'Saving...' : 'Save Settings to Database'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3 Main Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SQLite Database Status */}
        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-5 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-electric-blue dark:text-sky-400" />
              <h3 className="text-sm font-semibold text-midnight-ink dark:text-zinc-100">
                SQLite (WAL Mode) Persistence
              </h3>
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-tag text-[10px] font-bold ${
                info?.database.connected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
              }`}
            >
              {info?.database.connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Database Engine</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                better-sqlite3
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Concurrency Mode</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                WAL (Write-Ahead Log)
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Storage File</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                data/gateway.sqlite
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-clearbit-slate dark:text-zinc-400">Total Persisted Logs</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info?.stats.totalLogs || 0}
              </span>
            </div>
          </div>

          {info?.database.lastError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-btn text-[11px] text-rose-700 dark:text-rose-400 font-mono">
              {info.database.lastError}
            </div>
          )}
        </div>

        {/* Gateway Server */}
        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-5 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Server className="w-5 h-5 text-cobalt-surface dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-midnight-ink dark:text-zinc-100">
                Gateway Engine
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-tag text-[10px] font-bold bg-lavender-wash dark:bg-zinc-800 text-midnight-ink dark:text-zinc-300 border border-frost-border dark:border-zinc-700">
              PORT {info?.gateway.port || 7779}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Uptime</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info ? formatUptime(info.gateway.uptimeSeconds) : '0s'}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Node.js Runtime</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info?.gateway.nodeVersion}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Memory (RSS)</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info ? formatBytes(info.gateway.memoryUsage.rss) : '0 MB'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-clearbit-slate dark:text-zinc-400">Platform</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info?.gateway.platform}
              </span>
            </div>
          </div>
        </div>

        {/* Ngrok Integration */}
        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-5 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-5 h-5 text-electric-blue dark:text-sky-400" />
              <h3 className="text-sm font-semibold text-midnight-ink dark:text-zinc-100">
                Ngrok Status
              </h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded-tag text-[10px] font-bold ${
                info?.ngrok.status === 'ONLINE'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-lavender-wash dark:bg-zinc-800 text-clearbit-slate dark:text-zinc-400 border border-frost-border dark:border-zinc-700'
              }`}
            >
              {info?.ngrok.status || 'STOPPED'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Detection Mode</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info?.ngrok.mode}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Configured Domain</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200 truncate max-w-[150px]">
                {info?.ngrok.configuredDomain || 'Dynamic'}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-frost-border dark:border-zinc-800">
              <span className="text-clearbit-slate dark:text-zinc-400">Auth Token</span>
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                {info?.ngrok.hasAuthToken ? 'Configured in DB' : 'Not Set'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-clearbit-slate dark:text-zinc-400">Gateway Port Forwarded</span>
              <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-200">
                {info?.gateway.port || 7779}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Maintenance & Pruning */}
      <div className="p-6 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none space-y-4">
        <div>
          <h3 className="text-base font-semibold tracking-body text-midnight-ink dark:text-zinc-100">
            Database Maintenance & Cleanup
          </h3>
          <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
            Prune old historical request logs to maintain peak database performance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={() => handlePruneLogs(7)}
            disabled={cleaning}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs Older Than 7 Days</span>
          </button>

          <button
            onClick={() => handlePruneLogs(30)}
            disabled={cleaning}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn text-midnight-ink dark:text-zinc-200 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs Older Than 30 Days</span>
          </button>
        </div>
      </div>
    </div>
  );
};

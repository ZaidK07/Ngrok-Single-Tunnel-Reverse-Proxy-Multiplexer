import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  ArrowRight,
  Database,
  Radio,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Sun,
  Moon,
} from 'lucide-react';
import { configureGateway } from '../services/api';
import { NgrokStatus } from '../types';

interface SetupPageProps {
  onComplete: (status: NgrokStatus) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const SetupPage: React.FC<SetupPageProps> = ({
  onComplete,
  darkMode,
  setDarkMode,
}) => {
  const [authtoken, setAuthtoken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [domain, setDomain] = useState('');
  const [gatewayPort, setGatewayPort] = useState('7779');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<NgrokStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authtoken.trim()) {
      setError('Please provide your Ngrok auth token to proceed.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const status = await configureGateway({
        authtoken: authtoken.trim(),
        domain: domain.trim() || undefined,
        gatewayPort: parseInt(gatewayPort, 10) || 7779,
      });

      if (status.status === 'ERROR') {
        setError(status.errorMessage || 'Failed to start ngrok tunnel with provided token.');
      } else {
        setSuccessStatus(status);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to configure gateway. Please check your credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6">
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 border border-slate-300 dark:border-zinc-800 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 mb-3 shadow-xs">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Ngrok Multi-Redirect
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Single-Tunnel Reverse Proxy Multiplexer
          </p>

          {/* SQLite Auto-Engine Badge */}
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold mt-3">
            <Database className="w-3 h-3" />
            <span>Storage: Embedded SQLite Ready</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 sm:p-8 shadow-sm">
          {successStatus ? (
            /* Success View */
            <div className="text-center space-y-5">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                  Gateway Configured!
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Your tunnel is active and ready to multiplex routes to your local ports.
                </p>
              </div>

              {successStatus.publicUrl && (
                <div className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-sky-600 dark:text-sky-400 truncate select-all">
                    {successStatus.publicUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(successStatus.publicUrl!)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => onComplete(successStatus)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm"
              >
                <span>Enter Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  First-Time Gateway Setup
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Connect your Ngrok account to activate the multiplexer tunnel.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg flex items-start space-x-2.5 text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Ngrok Auth Token */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Ngrok Auth Token <span className="text-rose-500">*</span>
                  </label>
                  <a
                    href="https://dashboard.ngrok.com/get-started/your-authtoken"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Get Token</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    required
                    placeholder="e.g. 2sX4..."
                    value={authtoken}
                    onChange={(e) => setAuthtoken(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Ngrok Reserved Domain */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Custom / Reserved Domain <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. your-subdomain.ngrok-free.dev"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Leave empty to let Ngrok assign a random free domain.
                </p>
              </div>

              {/* Gateway Port */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Gateway Port
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={gatewayPort}
                  onChange={(e) => setGatewayPort(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Local port where reverse proxy multiplexer listens (default 7779).
                </p>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-sm transition-colors text-xs disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting Ngrok Tunnel...</span>
                    </>
                  ) : (
                    <>
                      <span>Connect & Launch Gateway</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

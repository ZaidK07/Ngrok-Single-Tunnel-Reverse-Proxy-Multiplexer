import React from 'react';
import {
  Radio,
  Layers,
  Activity,
  Settings,
  Sun,
  Moon,
  ExternalLink,
} from 'lucide-react';
import { NgrokStatus } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  ngrokStatus: NgrokStatus | null;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  ngrokStatus,
  darkMode,
  setDarkMode,
}) => {
  const isOnline = ngrokStatus?.status === 'ONLINE';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-frost-border dark:border-zinc-800 bg-paper dark:bg-zinc-900 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-btn bg-[#eef4ff] dark:bg-zinc-800 border border-frost-border dark:border-zinc-700 p-1.5 flex items-center justify-center text-electric-blue font-bold">
              <svg viewBox="0 0 256 256" fill="none" className="w-full h-full">
                <path d="M 44 128 H 104" stroke="#0f77ff" strokeWidth="22" strokeLinecap="round" />
                <circle cx="44" cy="128" r="14" fill="#0f77ff" />
                <path d="M 104 128 C 134 128 144 72 176 72 H 212" stroke="#0f77ff" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="212" cy="72" r="14" fill="#0f77ff" />
                <path d="M 104 128 H 212" stroke="#0f77ff" strokeWidth="22" strokeLinecap="round" />
                <circle cx="212" cy="128" r="14" fill="#0f77ff" />
                <path d="M 104 128 C 134 128 144 184 176 184 H 212" stroke="#0f77ff" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="212" cy="184" r="14" fill="#0f77ff" />
                <circle cx="104" cy="128" r="22" fill="#eef4ff" stroke="#0f77ff" strokeWidth="12" />
                <circle cx="104" cy="128" r="7" fill="#0f77ff" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-base tracking-body text-midnight-ink dark:text-zinc-100">
                  Ngrok Multi-Redirect
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-tag bg-lavender-wash dark:bg-zinc-800 text-midnight-ink dark:text-zinc-300 border border-frost-border dark:border-zinc-700">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-clearbit-slate dark:text-zinc-400 font-normal">
                Single-Tunnel HTTPS Multiplexer
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('gateway')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-btn text-sm font-medium transition-all ${
                activeTab === 'gateway'
                  ? 'bg-lavender-wash dark:bg-zinc-800 text-midnight-ink dark:text-zinc-100 border border-frost-border dark:border-zinc-700'
                  : 'text-clearbit-slate dark:text-zinc-400 hover:text-midnight-ink dark:hover:text-zinc-100 hover:bg-lavender-wash/60 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Gateway</span>
            </button>

            <button
              onClick={() => setActiveTab('nodes')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-btn text-sm font-medium transition-all ${
                activeTab === 'nodes' || activeTab === 'node-detail'
                  ? 'bg-lavender-wash dark:bg-zinc-800 text-midnight-ink dark:text-zinc-100 border border-frost-border dark:border-zinc-700'
                  : 'text-clearbit-slate dark:text-zinc-400 hover:text-midnight-ink dark:hover:text-zinc-100 hover:bg-lavender-wash/60 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Nodes</span>
            </button>

            <button
              onClick={() => setActiveTab('traffic')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-btn text-sm font-medium transition-all ${
                activeTab === 'traffic'
                  ? 'bg-lavender-wash dark:bg-zinc-800 text-midnight-ink dark:text-zinc-100 border border-frost-border dark:border-zinc-700'
                  : 'text-clearbit-slate dark:text-zinc-400 hover:text-midnight-ink dark:hover:text-zinc-100 hover:bg-lavender-wash/60 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Traffic</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-btn text-sm font-medium transition-all ${
                activeTab === 'settings'
                  ? 'bg-lavender-wash dark:bg-zinc-800 text-midnight-ink dark:text-zinc-100 border border-frost-border dark:border-zinc-700'
                  : 'text-clearbit-slate dark:text-zinc-400 hover:text-midnight-ink dark:hover:text-zinc-100 hover:bg-lavender-wash/60 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Status & Controls */}
          <div className="flex items-center space-x-3">
            {/* Live Tunnel Pill */}
            <div
              className={`hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-tag border text-xs font-semibold ${
                isOnline
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-lavender-wash dark:bg-zinc-800/60 text-clearbit-slate dark:text-zinc-400 border-frost-border dark:border-zinc-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-mist'
                }`}
              />
              <span>{isOnline ? 'TUNNEL ACTIVE' : 'TUNNEL STOPPED'}</span>
              {isOnline && ngrokStatus?.publicUrl && (
                <a
                  href={ngrokStatus.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:opacity-75"
                  title={ngrokStatus.publicUrl}
                >
                  <ExternalLink className="w-3 h-3 ml-0.5 inline" />
                </a>
              )}
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-btn border border-frost-border dark:border-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-800 text-clearbit-slate dark:text-zinc-300 transition-colors"
              title="Toggle Theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

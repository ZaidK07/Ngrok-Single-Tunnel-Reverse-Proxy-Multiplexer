import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { GatewayPage } from './pages/GatewayPage';
import { NodesPage } from './pages/NodesPage';
import { NodeDetailPage } from './pages/NodeDetailPage';
import { TrafficPage } from './pages/TrafficPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { NodeEntity, NgrokStatus, TrafficStats, CreateNodePayload } from './types';
import {
  getNgrokStatus,
  getNodes,
  getTrafficStats,
  startNgrok,
  stopNgrok,
  createNode,
  updateNode,
  deleteNode,
  pingNode,
  activateNode,
  getSetupStatus,
  getConfigSettings,
  updateConfigSettings,
} from './services/api';

// Parses current window.location.pathname into tab & optional node ID
const parseUrlRoute = (): { tab: string; nodeId: string | null } => {
  let path = window.location.pathname.replace(/\/+$/, '');
  if (path.startsWith('/dashboard')) {
    path = path.slice('/dashboard'.length);
  }
  if (!path || path === '' || path === '/') {
    return { tab: 'gateway', nodeId: null };
  }
  if (path.startsWith('/nodes/')) {
    const nodeId = path.replace('/nodes/', '');
    return { tab: 'node-detail', nodeId: decodeURIComponent(nodeId) };
  }
  if (path === '/nodes') {
    return { tab: 'nodes', nodeId: null };
  }
  if (path === '/traffic') {
    return { tab: 'traffic', nodeId: null };
  }
  if (path === '/settings') {
    return { tab: 'settings', nodeId: null };
  }
  if (path === '/gateway') {
    return { tab: 'gateway', nodeId: null };
  }
  return { tab: 'gateway', nodeId: null };
};

export const App: React.FC = () => {
  const initialRoute = parseUrlRoute();
  const [activeTab, setActiveTab] = useState<string>(initialRoute.tab);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialRoute.nodeId);
  const [nodes, setNodes] = useState<NodeEntity[]>([]);
  const [ngrokStatus, setNgrokStatus] = useState<NgrokStatus | null>(null);
  const [trafficStats, setTrafficStats] = useState<TrafficStats | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Check setup configuration status on boot
  useEffect(() => {
    let isMounted = true;
    const checkSetup = async () => {
      try {
        const setup = await getSetupStatus();
        if (isMounted) {
          setIsConfigured(Boolean(setup.isConfigured));
        }
      } catch {
        if (isMounted) {
          setIsConfigured(false);
        }
      }
    };
    checkSetup();
    return () => {
      isMounted = false;
    };
  }, []);

  // Navigate function that updates the browser URL and state
  const navigateTo = useCallback((tab: string, nodeId: string | null = null) => {
    let newPath = '/dashboard/' + tab;
    if (tab === 'gateway') {
      newPath = '/dashboard/gateway';
    } else if (tab === 'node-detail' && nodeId) {
      newPath = `/dashboard/nodes/${encodeURIComponent(nodeId)}`;
    }

    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
    setActiveTab(tab);
    setSelectedNodeId(nodeId);
  }, []);

  // Listen to browser popstate (back / forward buttons)
  useEffect(() => {
    const onPopState = () => {
      const route = parseUrlRoute();
      setActiveTab(route.tab);
      setSelectedNodeId(route.nodeId);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Theme initialized from database settings or default light (Clearbit theme)
  const [darkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    getConfigSettings()
      .then((cfg) => {
        if (cfg?.theme === 'dark') {
          setDarkMode(true);
        } else if (cfg?.theme === 'light') {
          setDarkMode(false);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleDarkMode = (isDark: boolean) => {
    setDarkMode(isDark);
    updateConfigSettings({ theme: isDark ? 'dark' : 'light' }).catch(() => {});
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Data fetching
  const refreshData = useCallback(async () => {
    try {
      const [status, nodesList, stats] = await Promise.allSettled([
        getNgrokStatus(),
        getNodes(),
        getTrafficStats(),
      ]);

      if (status.status === 'fulfilled') setNgrokStatus(status.value);
      if (nodesList.status === 'fulfilled') setNodes(nodesList.value);
      if (stats.status === 'fulfilled') setTrafficStats(stats.value);
    } catch (err) {
      // Ignored
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handlers
  const handleStartNgrok = async () => {
    const res = await startNgrok();
    setNgrokStatus(res);
  };

  const handleStopNgrok = async () => {
    const res = await stopNgrok();
    setNgrokStatus(res);
  };

  const handleCreateNode = async (payload: CreateNodePayload) => {
    const created = await createNode(payload);
    setNodes((prev) => [created, ...prev]);
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const updated = await updateNode(id, { is_active: !current });
    setNodes((prev) => prev.map((n) => (n.id === id ? updated : n)));
  };

  const handleDeleteNode = async (id: string) => {
    if (!window.confirm(`Are you sure you want to delete node '${id}'? This will also remove its logged requests.`)) {
      return;
    }
    await deleteNode(id);
    setNodes((prev) => prev.filter((n) => n.id !== id));
    if (selectedNodeId === id) {
      navigateTo('nodes');
    }
  };

  const handlePingNode = async (id: string) => {
    const result = await pingNode(id);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, last_health_status: result.status } : n,
      ),
    );
  };

  // Solution 1: Activates node session and opens root domain in a new tab
  const handleLaunchRootNode = async (id: string) => {
    await activateNode(id);
    const targetUrl = ngrokStatus?.publicUrl || 'http://localhost:7779';
    window.open(targetUrl + '/', '_blank');
  };

  const handleSelectNode = (id: string) => {
    navigateTo('node-detail', id);
  };

  const handleBackToNodes = () => {
    navigateTo('nodes');
  };

  if (isConfigured === false) {
    return (
      <SetupPage
        onComplete={(status) => {
          setNgrokStatus(status);
          setIsConfigured(true);
          refreshData();
          navigateTo('nodes');
        }}
        darkMode={darkMode}
        setDarkMode={handleToggleDarkMode}
      />
    );
  }

  if (isConfigured === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">Initializing Gateway...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper dark:bg-zinc-950 text-midnight-ink dark:text-zinc-100 selection:bg-cobalt-surface selection:text-white font-sans antialiased">
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => navigateTo(tab)}
        ngrokStatus={ngrokStatus}
        darkMode={darkMode}
        setDarkMode={handleToggleDarkMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'gateway' && (
          <GatewayPage
            ngrokStatus={ngrokStatus}
            onStartNgrok={handleStartNgrok}
            onStopNgrok={handleStopNgrok}
            trafficStats={trafficStats}
            nodes={nodes}
            onRefresh={refreshData}
            setActiveTab={(tab) => navigateTo(tab)}
          />
        )}

        {activeTab === 'nodes' && (
          <NodesPage
            nodes={nodes}
            ngrokStatus={ngrokStatus}
            onCreateNode={handleCreateNode}
            onToggleActive={handleToggleActive}
            onDeleteNode={handleDeleteNode}
            onPingNode={handlePingNode}
            onSelectNode={handleSelectNode}
            onRefresh={refreshData}
          />
        )}

        {activeTab === 'node-detail' && selectedNodeId && (
          <NodeDetailPage
            nodeId={selectedNodeId}
            nodes={nodes}
            ngrokStatus={ngrokStatus}
            onBack={handleBackToNodes}
            onToggleActive={handleToggleActive}
          />
        )}

        {activeTab === 'traffic' && <TrafficPage nodes={nodes} />}

        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <footer className="border-t border-frost-border dark:border-zinc-800 py-5 text-center text-xs text-clearbit-slate dark:text-zinc-500 bg-paper dark:bg-zinc-950">
        Ngrok Multi-Redirect &bull; Single-Tunnel Reverse Proxy Multiplexer
      </footer>
    </div>
  );
};

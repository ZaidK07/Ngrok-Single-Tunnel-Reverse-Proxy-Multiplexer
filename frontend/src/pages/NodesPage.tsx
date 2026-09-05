import React, { useState } from 'react';
import {
  Plus,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Power,
  Trash2,
  Search,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { NodeEntity, NgrokStatus, CreateNodePayload } from '../types';
import { CreateNodeModal } from '../components/CreateNodeModal';

interface NodesPageProps {
  nodes: NodeEntity[];
  ngrokStatus: NgrokStatus | null;
  onCreateNode: (payload: CreateNodePayload) => Promise<void>;
  onToggleActive: (id: string, current: boolean) => Promise<void>;
  onDeleteNode: (id: string) => Promise<void>;
  onPingNode: (id: string) => Promise<void>;
  onSelectNode: (id: string) => void;
  onRefresh: () => void;
}

export const NodesPage: React.FC<NodesPageProps> = ({
  nodes,
  ngrokStatus,
  onCreateNode,
  onToggleActive,
  onDeleteNode,
  onPingNode,
  onSelectNode,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('records_per_page');
      return saved ? parseInt(saved, 10) || 50 : 50;
    } catch {
      return 50;
    }
  });

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    try {
      localStorage.setItem('records_per_page', String(newSize));
    } catch {}
    setPage(1);
  };

  const isOnline = ngrokStatus?.status === 'ONLINE';
  const baseNgrokUrl =
    ngrokStatus?.publicUrl || 'https://unsmooth-jacklyn-unawakening.ngrok-free.dev';

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePing = async (id: string) => {
    try {
      setPingingId(id);
      await onPingNode(id);
    } finally {
      setPingingId(null);
    }
  };

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(n.port).includes(searchTerm),
  );

  const totalPages = Math.max(1, Math.ceil(filteredNodes.length / pageSize));
  const paginatedNodes = filteredNodes.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-heading-sm text-midnight-ink dark:text-zinc-100">
            Proxy Nodes
          </h2>
          <p className="text-xs text-clearbit-slate dark:text-zinc-400 mt-0.5">
            Dedicated block endpoints routing traffic to your local ports
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            className="p-2 text-clearbit-slate hover:text-midnight-ink dark:text-zinc-400 dark:hover:text-zinc-200 border border-frost-border dark:border-zinc-700 rounded-btn hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
            title="Refresh Nodes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-cobalt-surface hover:bg-electric-blue text-white text-xs font-medium rounded-btn transition-colors shadow-none"
          >
            <Plus className="w-4 h-4" />
            <span>Create Node</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-mist" />
        <input
          type="text"
          placeholder="Filter by name, port, or node ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
        />
      </div>

      {/* Nodes Table */}
      {filteredNodes.length === 0 ? (
        <div className="text-center py-16 bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card p-8">
          <Layers className="w-10 h-10 mx-auto text-mist dark:text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-midnight-ink dark:text-zinc-100">
            No proxy nodes found
          </h3>
          <p className="text-xs text-clearbit-slate dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm
              ? 'No nodes match your current search query.'
              : 'Create your first proxy node to map a local service port to a live Ngrok sub-path.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-cobalt-surface hover:bg-electric-blue text-white text-xs font-medium rounded-btn shadow-none"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Node</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card overflow-hidden shadow-none">
          <div className="w-full overflow-hidden">
            <table className="w-full text-left text-xs table-fixed">
              <thead className="bg-lavender-wash/70 dark:bg-zinc-950 border-b border-frost-border dark:border-zinc-800 text-clearbit-slate dark:text-zinc-400 font-semibold uppercase tracking-caption">
                <tr>
                  <th className="py-3 px-3 w-40">Node Info</th>
                  <th className="py-3 px-3 w-36 whitespace-nowrap">Local Target</th>
                  <th className="py-3 px-3">Live Block URL</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap text-center">Status</th>
                  <th className="py-3 px-3 w-16 whitespace-nowrap text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-frost-border dark:divide-zinc-800 text-midnight-ink dark:text-zinc-300">
                {paginatedNodes.map((node) => {
                  const liveUrl = `${baseNgrokUrl}/${node.slug}/`;
                  const isHealthy = node.last_health_status === 'HEALTHY';

                  return (
                    <tr
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      className="cursor-pointer hover:bg-lavender-wash/40 dark:hover:bg-zinc-800/60 transition-colors group"
                      title="Click row to view node details"
                    >
                      {/* Node Info */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-midnight-ink dark:text-zinc-100 text-sm group-hover:text-electric-blue dark:group-hover:text-sky-400 transition-colors">
                          {node.name}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-tag bg-lavender-wash dark:bg-zinc-800 text-clearbit-slate dark:text-zinc-400 border border-frost-border dark:border-zinc-700">
                            ID: {node.id}
                          </span>
                          {node.description && (
                            <span className="text-[11px] text-clearbit-slate dark:text-zinc-400 truncate max-w-xs">
                              {node.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Local Target & Health */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isHealthy ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                            title={isHealthy ? 'Port is listening' : 'Port is unreachable'}
                          />
                          <span className="font-mono font-semibold text-midnight-ink dark:text-zinc-100">
                            localhost:{node.port}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] text-clearbit-slate dark:text-zinc-400">
                            {node.last_health_status}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePing(node.id);
                            }}
                            disabled={pingingId === node.id}
                            className="text-[10px] text-electric-blue dark:text-sky-400 hover:underline font-medium"
                          >
                            {pingingId === node.id ? 'Checking...' : 'Ping Port'}
                          </button>
                        </div>
                      </td>

                      {/* Live Block URL */}
                      <td className="py-3 px-3 min-w-0">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <div className="font-mono text-xs text-electric-blue dark:text-sky-400 bg-cobalt-surface/10 dark:bg-sky-950/40 border border-cobalt-surface/30 dark:border-sky-800 px-2.5 py-1 rounded-btn select-all truncate min-w-0" title={liveUrl}>
                            {liveUrl}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(node.id, liveUrl);
                            }}
                            className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 hover:bg-lavender-wash dark:hover:bg-zinc-800 rounded-btn transition-colors shrink-0"
                            title="Copy Live URL"
                          >
                            {copiedId === node.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {isOnline && (
                            <a
                              href={liveUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 text-mist hover:text-midnight-ink dark:hover:text-zinc-200 hover:bg-lavender-wash dark:hover:bg-zinc-800 rounded-btn transition-colors shrink-0"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Active Status Toggle */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleActive(node.id, node.is_active);
                          }}
                          className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-tag text-[11px] font-semibold border transition-colors ${
                            node.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-lavender-wash dark:bg-zinc-800 text-clearbit-slate dark:text-zinc-400 border-frost-border dark:border-zinc-700'
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          <span>{node.is_active ? 'ACTIVE' : 'PAUSED'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNode(node.id);
                          }}
                          className="p-1.5 text-mist hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40 rounded-btn transition-colors inline-flex items-center justify-center"
                          title="Delete Node"
                        >
                          <Trash2 className="w-4 h-4" />
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
              {filteredNodes.length > 0 ? (
                <span>
                  Page <strong className="text-midnight-ink dark:text-zinc-200">{page}</strong> of{' '}
                  <strong className="text-midnight-ink dark:text-zinc-200">{totalPages}</strong> ({filteredNodes.length} nodes)
                </span>
              ) : (
                <span>0 nodes</span>
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
                  disabled={page >= totalPages}
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

      {/* Create Node Modal */}
      <CreateNodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onCreateNode}
        existingSlugs={nodes.map((n) => n.slug)}
      />
    </div>
  );
};

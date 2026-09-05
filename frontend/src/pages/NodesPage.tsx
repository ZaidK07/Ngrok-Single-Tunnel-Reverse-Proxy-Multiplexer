import React, { useState } from 'react';
import {
  Plus,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Power,
  Trash2,
  Activity,
  Search,
  RefreshCw,
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

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
            Proxy Nodes
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Dedicated block endpoints routing traffic to your local ports
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 border border-slate-300 dark:border-zinc-700 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh Nodes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Node</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter by name, port, or node ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Nodes Table */}
      {filteredNodes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-8">
          <Layers className="w-10 h-10 mx-auto text-slate-400 dark:text-zinc-600 mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
            No proxy nodes found
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm
              ? 'No nodes match your current search query.'
              : 'Create your first proxy node to map a local service port to a live Ngrok sub-path.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Node</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-48 font-semibold uppercase tracking-wider">Node Info</th>
                  <th className="py-3 px-4 w-44 whitespace-nowrap font-semibold uppercase tracking-wider">Local Target</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Live Block URL</th>
                  <th className="py-3 px-4 w-32 whitespace-nowrap text-center font-semibold uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 w-20 whitespace-nowrap text-center font-semibold uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                {filteredNodes.map((node) => {
                  const liveUrl = `${baseNgrokUrl}/${node.slug}`;
                  const isHealthy = node.last_health_status === 'HEALTHY';

                  return (
                    <tr
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      className="cursor-pointer hover:bg-slate-50/90 dark:hover:bg-zinc-800/60 transition-colors group"
                      title="Click row to view node details"
                    >
                      {/* Node Info */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-zinc-100 text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                          {node.name}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                            ID: {node.id}
                          </span>
                          {node.description && (
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-xs">
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
                          <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                            localhost:{node.port}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] text-slate-400">
                            {node.last_health_status}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePing(node.id);
                            }}
                            disabled={pingingId === node.id}
                            className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline"
                          >
                            {pingingId === node.id ? 'Checking...' : 'Ping Port'}
                          </button>
                        </div>
                      </td>

                      {/* Live Block URL */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <div className="font-mono text-xs text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2.5 py-1 rounded select-all whitespace-nowrap">
                            {liveUrl}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(node.id, liveUrl);
                            }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
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
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
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
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                            node.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
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
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors inline-flex items-center justify-center"
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

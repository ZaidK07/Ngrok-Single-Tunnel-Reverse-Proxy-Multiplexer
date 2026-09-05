import React, { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { CreateNodePayload } from '../types';
import { Toggle } from './Toggle';

interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateNodePayload) => Promise<void>;
  existingSlugs: string[];
}

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingSlugs,
}) => {
  const [name, setName] = useState('');
  const [port, setPort] = useState('');
  const [id, setId] = useState('');
  const [description, setDescription] = useState('');
  const [stripPrefix, setStripPrefix] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const portNum = parseInt(port, 10);
    if (!name.trim()) {
      setError('Node Name is required.');
      return;
    }
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError('Node Port must be a valid port number between 1 and 65535.');
      return;
    }
    const cleanId = id.trim().toLowerCase();
    if (!cleanId) {
      setError('Node ID is required.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) {
      setError('Node ID must contain only letters, numbers, hyphens, and underscores.');
      return;
    }
    if (existingSlugs.includes(cleanId)) {
      setError(`Node ID '${cleanId}' is already in use. Please choose a unique ID.`);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        port: portNum,
        id: cleanId,
        description: description.trim() || undefined,
        strip_prefix: stripPrefix,
      });
      // Reset form on success
      setName('');
      setPort('');
      setId('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to create node.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoGenerateId = () => {
    if (port) {
      setId(port);
    } else if (name) {
      setId(
        name
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-')
          .replace(/^-+|-+$/g, ''),
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-none transition-opacity">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
            Create Proxy Node
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg">
              {error}
            </div>
          )}

          {/* Node Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Node Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Wiki, Stripe Webhook, Storefront"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Node Port */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Target Port
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              placeholder="e.g. 3000"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Node ID / Slug */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                URL Path
              </label>
              <button
                type="button"
                onClick={autoGenerateId}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-fill</span>
              </button>
            </div>
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-r-0 border-slate-300 dark:border-zinc-700 rounded-l-lg select-none">
                /
              </span>
              <input
                type="text"
                required
                placeholder="custom-wiki"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().trim())}
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-r-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Strip Prefix Toggle */}
          <div className="pt-1">
            <Toggle
              checked={stripPrefix}
              onChange={setStripPrefix}
              label="Strip path prefix when forwarding to local target"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create Node'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

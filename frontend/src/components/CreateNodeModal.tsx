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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight-ink/50 backdrop-blur-xs transition-opacity font-sans">
      <div className="w-full max-w-md bg-paper dark:bg-zinc-900 border border-frost-border dark:border-zinc-800 rounded-card shadow-none overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-frost-border dark:border-zinc-800">
          <h3 className="text-base font-semibold tracking-body text-midnight-ink dark:text-zinc-100">
            Create Proxy Node
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-btn text-clearbit-slate hover:text-midnight-ink dark:hover:text-zinc-200 hover:bg-lavender-wash dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs font-medium text-rose-700 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-btn">
              {error}
            </div>
          )}

          {/* Node Name */}
          <div>
            <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption mb-1.5">
              Node Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Wiki, Stripe Webhook, Storefront"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
            />
          </div>

          {/* Node Port */}
          <div>
            <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption mb-1.5">
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
              className="w-full px-3.5 py-2 text-sm font-mono bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
            />
          </div>

          {/* Node ID / Slug */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption">
                URL Path
              </label>
              <button
                type="button"
                onClick={autoGenerateId}
                className="text-xs text-electric-blue dark:text-sky-400 hover:underline flex items-center space-x-1 font-medium"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-fill</span>
              </button>
            </div>
            <div className="flex items-center">
              <span className="px-3 py-2 text-xs font-mono bg-lavender-wash dark:bg-zinc-800 text-clearbit-slate dark:text-zinc-400 border border-r-0 border-frost-border dark:border-zinc-700 rounded-l-btn select-none">
                /
              </span>
              <input
                type="text"
                required
                placeholder="custom-wiki"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().trim())}
                className="w-full px-3 py-2 text-sm font-mono bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-r-btn text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-clearbit-slate dark:text-zinc-300 uppercase tracking-caption mb-1.5">
              Description <span className="text-mist font-normal lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-lavender-wash/40 dark:bg-zinc-950 border border-frost-border dark:border-zinc-700 rounded-input text-midnight-ink dark:text-zinc-100 placeholder-mist focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
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
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-frost-border dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-clearbit-slate hover:text-midnight-ink dark:text-zinc-300 bg-paper dark:bg-zinc-800 hover:bg-lavender-wash dark:hover:bg-zinc-700 border border-frost-border dark:border-zinc-700 rounded-btn transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-medium text-white bg-cobalt-surface hover:bg-electric-blue rounded-btn shadow-none transition-colors disabled:opacity-50"
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

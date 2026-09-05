import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`inline-flex items-center space-x-2.5 cursor-pointer select-none group disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <div
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
          checked
            ? 'bg-cobalt-surface border-cobalt-surface dark:bg-cobalt-surface dark:border-cobalt-surface'
            : 'bg-mist/30 border-frost-border dark:bg-zinc-700 dark:border-zinc-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          }`}
        />
      </div>
      {label && (
        <span className="text-xs font-medium text-clearbit-slate dark:text-zinc-400 group-hover:text-midnight-ink dark:group-hover:text-zinc-200 transition-colors">
          {label}
        </span>
      )}
    </button>
  );
};

import React from 'react';
import { Globe } from 'lucide-react';

interface TargetApplicationProps {
  url: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const TargetApplication: React.FC<TargetApplicationProps> = ({
  url,
  onChange,
  disabled = false,
}) => {
  return (
    <div id="target-application-section" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor="target-url-input"
          className="text-xs font-mono font-semibold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5"
        >
          <Globe className="h-3.5 w-3.5 text-zinc-400" />
          TARGET APPLICATION
        </label>
        <span className="text-[11px] font-mono text-zinc-500">
          Black-Box Target URL
        </span>
      </div>

      <div className="relative">
        <input
          id="target-url-input"
          type="url"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com"
          disabled={disabled}
          className="w-full px-3.5 py-2.5 rounded-md bg-zinc-900/90 border border-zinc-700/80 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 focus:border-emerald-500/80 transition-colors shadow-inner"
        />
      </div>

      <p className="text-xs text-zinc-400">
        Enter the web application the agent should test.
      </p>
    </div>
  );
};

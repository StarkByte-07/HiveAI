import React from 'react';
import { Play, Loader2, AlertCircle, CheckCircle2, Laptop } from 'lucide-react';

interface RunAgentButtonProps {
  onRunAgent: () => void;
  isLaunching: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  onDismissMessage?: () => void;
}

export const RunAgentButton: React.FC<RunAgentButtonProps> = ({
  onRunAgent,
  isLaunching,
  statusMessage,
  errorMessage,
  onDismissMessage,
}) => {
  return (
    <div id="run-agent-container" className="flex flex-col items-end gap-2.5">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline flex items-center gap-1.5">
          <Laptop className="h-3 w-3 text-zinc-400" />
          Phase 2: Playwright Chromium Runtime
        </span>

        <button
          id="run-agent-btn"
          type="button"
          onClick={onRunAgent}
          disabled={isLaunching}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-950 font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950/40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
        >
          {isLaunching ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
              <span>LAUNCHING BROWSER...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>RUN AGENT</span>
            </>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          id="phase-error-banner"
          className="w-full sm:max-w-lg p-3 rounded-md bg-rose-950/50 border border-rose-800/80 text-xs text-rose-200 shadow-lg flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-rose-100 font-mono">
              Browser Launch / Navigation Error
            </p>
            <p className="text-[11px] text-rose-300 leading-relaxed font-sans">
              {errorMessage}
            </p>
          </div>
          {onDismissMessage && (
            <button
              type="button"
              onClick={onDismissMessage}
              className="text-rose-400 hover:text-rose-200 font-mono text-xs px-1"
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Success Status Banner */}
      {statusMessage && !errorMessage && (
        <div
          id="phase-status-banner"
          className="w-full sm:max-w-lg p-3 rounded-md bg-emerald-950/50 border border-emerald-800/80 text-xs text-emerald-200 shadow-lg flex items-start gap-2.5 animate-in fade-in"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-emerald-100 font-mono">
              Target Page Opened in Chromium
            </p>
            <p className="text-[11px] text-emerald-300 leading-relaxed font-sans">
              {statusMessage}
            </p>
          </div>
          {onDismissMessage && (
            <button
              type="button"
              onClick={onDismissMessage}
              className="text-emerald-400 hover:text-emerald-200 font-mono text-xs px-1"
              aria-label="Dismiss message"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
};

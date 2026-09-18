import React from 'react';
import { SearchCheck, Eye, Sparkles, AlertCircle } from 'lucide-react';
import { FindingsSummary } from '../types/index.ts';

interface FindingsPanelProps {
  findings?: FindingsSummary;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings = {
    accessibilityCount: 0,
    uxFrictionCount: 0,
    potentialIssuesCount: 0,
  },
}) => {
  return (
    <div
      id="findings-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col h-full"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <SearchCheck className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            FINDINGS
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Auditing Metrics
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Accessibility counter */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase mb-2">
            <Eye className="h-3 w-3 text-cyan-400/80" />
            <span className="truncate">Accessibility</span>
          </div>
          <span className="text-2xl font-mono font-bold text-zinc-400 mt-auto">
            {findings.accessibilityCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-600 mt-0.5">
            issues
          </span>
        </div>

        {/* UX Friction counter */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase mb-2">
            <Sparkles className="h-3 w-3 text-amber-400/80" />
            <span className="truncate">UX Friction</span>
          </div>
          <span className="text-2xl font-mono font-bold text-zinc-400 mt-auto">
            {findings.uxFrictionCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-600 mt-0.5">
            friction points
          </span>
        </div>

        {/* Potential Issues counter */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase mb-2">
            <AlertCircle className="h-3 w-3 text-rose-400/80" />
            <span className="truncate">Potential Issues</span>
          </div>
          <span className="text-2xl font-mono font-bold text-zinc-400 mt-auto">
            {findings.potentialIssuesCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-600 mt-0.5">
            anomalies
          </span>
        </div>
      </div>

      <div className="p-2.5 rounded bg-zinc-950/30 border border-zinc-800/40 text-center">
        <p className="text-[11px] text-zinc-500 font-mono">
          No audit has been performed yet. Counters initialized to 0.
        </p>
      </div>
    </div>
  );
};

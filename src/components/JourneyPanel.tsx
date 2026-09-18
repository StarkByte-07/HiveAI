import React from 'react';
import { Route, CheckCircle2, Clock } from 'lucide-react';
import { JourneyStep } from '../types/index.ts';

interface JourneyPanelProps {
  steps?: JourneyStep[];
}

export const JourneyPanel: React.FC<JourneyPanelProps> = ({ steps = [] }) => {
  return (
    <div
      id="live-journey-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col h-full"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            LIVE JOURNEY
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Trace Execution
        </span>
      </div>

      {steps.length === 0 ? (
        <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800/80 rounded-md bg-zinc-950/30">
          <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-2.5">
            <Route className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-zinc-300">
            No journey recorded yet.
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-xs leading-relaxed">
            Agent actions will appear here during execution.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {steps.map((step) => (
            <div
              key={step.stepNumber}
              className="p-3 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs flex items-start gap-3 animate-in fade-in"
            >
              <div className="flex items-center justify-center h-6 w-6 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono font-bold text-[11px] shrink-0">
                {String(step.stepNumber).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-zinc-850 text-cyan-400 border border-zinc-700">
                    {step.action}
                  </span>
                  {step.timestamp && (
                    <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {step.timestamp}
                    </span>
                  )}
                </div>
                <p className="font-mono text-zinc-200 text-xs break-all">
                  {step.description}
                </p>
                {step.url && (
                  <p className="font-mono text-[11px] text-zinc-400 truncate">
                    URL: <span className="text-zinc-300">{step.url}</span>
                  </p>
                )}
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            </div>
          ))}
          <p className="text-[10px] font-mono text-zinc-500 text-right pt-1">
            Genuine backend trace • No simulated steps
          </p>
        </div>
      )}
    </div>
  );
};

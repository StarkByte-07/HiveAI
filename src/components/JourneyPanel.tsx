import React from 'react';
import {
  Route,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  Sparkles,
  Zap,
  MousePointer,
  Keyboard,
  ArrowUpDown,
  RotateCcw,
  Hourglass,
  Flag,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { JourneyStep } from '../types/index.ts';

interface JourneyPanelProps {
  steps?: JourneyStep[];
}

export const JourneyPanel: React.FC<JourneyPanelProps> = ({ steps = [] }) => {
  const getActionBadge = (step: JourneyStep) => {
    const act = (step.actionType || step.action || '').toLowerCase();
    
    if (step.action === 'navigate') {
      return {
        label: 'NAVIGATE',
        icon: <Compass className="h-2.5 w-2.5" />,
        style: 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50',
        badgeBg: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
      };
    }
    if (step.action === 'observe') {
      return {
        label: 'OBSERVE',
        icon: <Eye className="h-2.5 w-2.5" />,
        style: 'bg-cyan-950/50 text-cyan-300 border-cyan-800/50',
        badgeBg: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
      };
    }
    if (step.action === 'reason') {
      return {
        label: 'REASON',
        icon: <Sparkles className="h-2.5 w-2.5" />,
        style: 'bg-purple-950/50 text-purple-300 border-purple-800/50',
        badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-800/60',
      };
    }
    if (step.action === 'finish' || act === 'finish') {
      return {
        label: 'FINISH',
        icon: <Flag className="h-2.5 w-2.5" />,
        style: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/60 font-bold',
        badgeBg: 'bg-emerald-900/80 text-emerald-300 border-emerald-600',
      };
    }
    if (step.action === 'error' || act === 'error') {
      return {
        label: 'ERROR',
        icon: <AlertCircle className="h-2.5 w-2.5" />,
        style: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
        badgeBg: 'bg-rose-950/80 text-rose-400 border-rose-800',
      };
    }

    // Interactive Browser Actions
    let icon = <Zap className="h-2.5 w-2.5" />;
    let label = `ACTION — ${act.toUpperCase()}`;

    if (act === 'click') {
      icon = <MousePointer className="h-2.5 w-2.5" />;
    } else if (act === 'type') {
      icon = <Keyboard className="h-2.5 w-2.5" />;
    } else if (act === 'scroll') {
      icon = <ArrowUpDown className="h-2.5 w-2.5" />;
    } else if (act === 'wait') {
      icon = <Hourglass className="h-2.5 w-2.5" />;
    } else if (act === 'back') {
      icon = <RotateCcw className="h-2.5 w-2.5" />;
    }

    return {
      label,
      icon,
      style: 'bg-amber-950/50 text-amber-300 border-amber-800/50',
      badgeBg: 'bg-amber-950/80 text-amber-400 border-amber-800/60',
    };
  };

  return (
    <div
      id="live-journey-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col h-full"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            LIVE AGENT JOURNEY TRACE
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          {steps.length} Steps Recorded
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
            Autonomous Observe → Reason → Act cycle will trace in real-time here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
          {steps.map((step) => {
            const badge = getActionBadge(step);
            const isRunning = step.status === 'running' || step.status === 'pending';
            const isFailed = step.status === 'failed';

            return (
              <div
                key={`${step.stepNumber}-${step.action}-${step.timestamp || ''}`}
                className="p-3 rounded-md bg-zinc-950/60 border border-zinc-800 text-xs flex items-start gap-3 animate-in fade-in transition-colors"
              >
                {/* Step Number Badge */}
                <div
                  className={`flex items-center justify-center h-6 w-6 rounded border font-mono font-bold text-[11px] shrink-0 ${badge.badgeBg}`}
                >
                  {String(step.stepNumber).padStart(2, '0')}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border flex items-center gap-1 ${badge.style}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                    {step.timestamp && (
                      <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {step.timestamp}
                      </span>
                    )}
                  </div>

                  <p className="font-mono text-zinc-200 text-xs break-words leading-relaxed">
                    {step.description}
                  </p>

                  {/* Gemini Rationale / Explanation if present */}
                  {step.explanation && (
                    <div className="text-[11px] font-mono text-zinc-400 pl-2 border-l border-purple-500/40 bg-zinc-900/30 p-1.5 rounded-r">
                      <span className="text-purple-400/80 font-semibold">Gemini: </span>
                      {step.explanation}
                    </div>
                  )}

                  {step.url && (
                    <p className="font-mono text-[11px] text-zinc-400 truncate">
                      URL: <span className="text-zinc-300">{step.url}</span>
                    </p>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="shrink-0 mt-0.5">
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                  ) : isFailed ? (
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-[10px] font-mono text-zinc-500 text-right pt-1">
            Genuine backend trace • No simulated steps
          </p>
        </div>
      )}
    </div>
  );
};

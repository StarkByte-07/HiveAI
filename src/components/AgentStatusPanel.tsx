import React from 'react';
import { Activity, Laptop, Bot, Footprints, Compass, Loader2, Globe, Sparkles, Zap, CheckCircle2, AlertTriangle, Square } from 'lucide-react';
import { AgentStatus } from '../types/index.ts';

interface AgentStatusPanelProps {
  status: AgentStatus;
  onStopAgent?: () => void;
}

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({ status, onStopAgent }) => {
  const getBadgeStyle = () => {
    switch (status.state) {
      case 'READY':
        return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
      case 'STARTING BROWSER':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/60 animate-pulse';
      case 'BROWSER LAUNCHED':
        return 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60';
      case 'TARGET PAGE OPENED':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-700/80';
      case 'OBSERVING PAGE':
        return 'bg-amber-950/60 text-amber-400 border-amber-800/60 animate-pulse';
      case 'PAGE OBSERVED':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80';
      case 'REASONING':
        return 'bg-purple-950/70 text-purple-300 border-purple-700/80 animate-pulse';
      case 'EXECUTING ACTION':
        return 'bg-cyan-950/70 text-cyan-300 border-cyan-600/80 animate-pulse';
      case 'ACTION COMPLETED':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-700/80';
      case 'ACTION FAILED':
        return 'bg-rose-950/70 text-rose-300 border-rose-700/80';
      case 'GOAL COMPLETED':
        return 'bg-emerald-900/80 text-emerald-200 border-emerald-500 font-bold';
      case 'BLOCKED':
        return 'bg-amber-950/80 text-amber-300 border-amber-600 font-bold';
      case 'AGENT FAILED':
      case 'ERROR':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/60';
      case 'STOPPED':
        return 'bg-amber-950/60 text-amber-400 border-amber-700/60';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getDotStyle = () => {
    switch (status.state) {
      case 'READY':
      case 'TARGET PAGE OPENED':
      case 'PAGE OBSERVED':
      case 'ACTION COMPLETED':
      case 'GOAL COMPLETED':
        return 'bg-emerald-400';
      case 'STARTING BROWSER':
      case 'OBSERVING PAGE':
      case 'STOPPED':
        return 'bg-amber-400 animate-ping';
      case 'REASONING':
        return 'bg-purple-400 animate-ping';
      case 'EXECUTING ACTION':
        return 'bg-cyan-400 animate-ping';
      case 'BROWSER LAUNCHED':
        return 'bg-cyan-400';
      case 'ACTION FAILED':
      case 'AGENT FAILED':
      case 'ERROR':
        return 'bg-rose-400';
      default:
        return 'bg-zinc-500';
    }
  };

  const formatStepName = (stepNum: number | null) => {
    if (stepNum === null) return '—';
    return `Step ${String(stepNum).padStart(2, '0')}`;
  };

  const isLive = ['STARTING BROWSER', 'OBSERVING PAGE', 'REASONING', 'EXECUTING ACTION'].includes(status.state);

  return (
    <div
      id="agent-status-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm space-y-3"
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            AGENT STATUS &amp; REASONING TELEMETRY
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {status.isRunning && onStopAgent && (
            <button
              type="button"
              onClick={onStopAgent}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 border border-rose-800/80 transition-colors cursor-pointer"
              title="Stop current agent execution"
            >
              <Square className="h-2.5 w-2.5 fill-current" />
              STOP
            </button>
          )}
          <div
            id="agent-state-badge"
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold border ${getBadgeStyle()}`}
          >
            {isLive ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${getDotStyle()}`}></span>
            )}
            {status.state}
          </div>
        </div>
      </div>

      {/* Live Agent Activity Headline Area */}
      {status.activity && (
        <div
          id="live-agent-activity-banner"
          className="p-3 rounded-md bg-zinc-950/70 border border-zinc-800/80 text-xs space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wide bg-zinc-900 text-cyan-300 border border-zinc-800 flex items-center gap-1">
                {status.activity.phase === 'REASON' && <Sparkles className="h-2.5 w-2.5 text-purple-400" />}
                {status.activity.phase === 'ACT' && <Zap className="h-2.5 w-2.5 text-cyan-400" />}
                {status.activity.phase === 'COMPLETE' && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                {status.activity.phase === 'ERROR' && <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />}
                {status.activity.phase}
              </span>
              <span className="font-mono text-zinc-200 font-semibold text-xs truncate">
                {status.activity.headline}
              </span>
            </div>
            {status.activity.timestamp && (
              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                {status.activity.timestamp}
              </span>
            )}
          </div>
          {status.activity.explanation && (
            <p className="text-[11px] font-mono text-zinc-400 pl-1 border-l-2 border-purple-500/50 leading-relaxed">
              <span className="text-zinc-500">Rationale: </span>
              {status.activity.explanation}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Browser Status */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5 mb-1">
            <Laptop className="h-3 w-3 text-zinc-400" />
            Browser
          </div>
          <div className="font-mono text-zinc-200 font-medium truncate" title={status.browserStatus}>
            {status.browserStatus}
          </div>
        </div>

        {/* Agent State */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5 mb-1">
            <Bot className="h-3 w-3 text-zinc-400" />
            Agent
          </div>
          <div className="font-mono text-zinc-200 font-medium truncate">
            {status.agentStatus}
          </div>
        </div>

        {/* Current Step */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5 mb-1">
            <Footprints className="h-3 w-3 text-zinc-400" />
            Current step
          </div>
          <div className="font-mono text-zinc-300 font-medium">
            {status.currentStep !== null ? (
              <span className="text-emerald-400 font-semibold">
                {formatStepName(status.currentStep)}
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>

        {/* Current URL */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1.5 mb-1">
            <Compass className="h-3 w-3 text-zinc-400" />
            Current URL
          </div>
          <div className="font-mono text-zinc-300 font-medium truncate" title={status.currentUrl || 'None'}>
            {status.currentUrl ? (
              <span className="text-cyan-300 underline underline-offset-2 decoration-cyan-700/50">
                {status.currentUrl}
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Page Title & Environment Details if active */}
      {status.pageTitle && (
        <div className="pt-2 px-1 border-t border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <Globe className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="text-zinc-500">Page Title:</span>
            <span className="text-zinc-200 truncate font-semibold">
              "{status.pageTitle}"
            </span>
          </div>
          {status.isHeadlessFallback && (
            <span className="text-[10px] text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50 shrink-0">
              Container environment: headless fallback (Visible Chromium on desktop)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

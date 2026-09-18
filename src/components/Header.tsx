import React from 'react';
import { Terminal, Cpu } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header id="main-header" className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-100 shadow-sm shrink-0">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-zinc-100 uppercase font-mono">
                HIVEAI
              </h1>
              <span className="text-xs text-zinc-500 font-mono font-medium">/ FlowSentry</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-800 text-cyan-300 border border-cyan-800/60">
                P8 • PHASE 4: AGENTIC LOOP
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 tracking-wide">
              Autonomous Agentic Black-Box UI/UX &amp; Accessibility Testing Framework
            </p>
          </div>
        </div>

        {/* Runtime Status */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-zinc-400 uppercase tracking-wider text-[11px] font-medium">GEMINI REASONING + PLAYWRIGHT</span>
            <span className="text-zinc-600">|</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold tracking-wide">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ACTIVE
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

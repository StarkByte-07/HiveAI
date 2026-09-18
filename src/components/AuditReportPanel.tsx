import React from 'react';
import { FileText, ClipboardList, Star, Compass, Database, CheckCircle2 } from 'lucide-react';
import { AuditReport, GoalIntentType } from '../types/index.ts';

interface AuditReportPanelProps {
  report?: AuditReport;
}

export const AuditReportPanel: React.FC<AuditReportPanelProps> = ({
  report = {
    goal: null,
    status: null,
    totalSteps: null,
    accessibilityFindings: null,
    uxFrictionFindings: null,
  },
}) => {
  const hasExtractedResults = report.extractedResults && report.extractedResults.length > 0;

  const getIntentBadge = (intent?: GoalIntentType | null) => {
    if (!intent) return null;
    switch (intent) {
      case 'INFORMATION_RETRIEVAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/80 flex items-center gap-1">
            <Database className="h-2.5 w-2.5" />
            INFORMATION RETRIEVAL
          </span>
        );
      case 'NAVIGATION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 flex items-center gap-1">
            <Compass className="h-2.5 w-2.5" />
            NAVIGATION
          </span>
        );
      case 'SEARCH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/80">
            SEARCH
          </span>
        );
      case 'ACTION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
            ACTION
          </span>
        );
      case 'VERIFICATION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-950/60 text-indigo-300 border border-indigo-800/80">
            VERIFICATION
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      id="audit-report-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col space-y-3"
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            AUDIT REPORT &amp; RETRIEVED DATA
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {getIntentBadge(report.intentType)}
          <span className="text-[11px] font-mono text-zinc-500">
            Executive Summary
          </span>
        </div>
      </div>

      {!report.status && (
        <div className="p-3 rounded-md bg-zinc-950/40 border border-zinc-800/60 flex items-center gap-2.5">
          <ClipboardList className="h-4 w-4 text-zinc-500 shrink-0" />
          <p className="text-xs text-zinc-400">
            Run an agent audit to generate a report and retrieve information.
          </p>
        </div>
      )}

      {/* Main Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        {/* Goal */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60 lg:col-span-2">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Goal
          </div>
          <div className="font-mono text-zinc-300 truncate font-medium" title={report.goal || 'None'}>
            {report.goal || '—'}
          </div>
        </div>

        {/* Status */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Status
          </div>
          <div className="font-mono text-zinc-300 font-medium">
            {report.status ? (
              <span className={report.status === 'Completed' ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>
                {report.status}
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>

        {/* Total Steps */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Total Steps
          </div>
          <div className="font-mono text-zinc-300 font-medium">
            {report.totalSteps !== null ? report.totalSteps : '—'}
          </div>
        </div>

        {/* Results Count / Accessibility Findings */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Items Retrieved
          </div>
          <div className="font-mono text-zinc-300 font-medium">
            {hasExtractedResults ? (
              <span className="text-amber-300 font-bold">
                {report.extractedResults!.length} items
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Extracted Results Cards for Information Retrieval Goals */}
      {hasExtractedResults && (
        <div className="p-3 rounded-md bg-zinc-950/70 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>COLLECTED RESULTS ({report.extractedResults!.length} ITEMS)</span>
            </div>
            <span className="text-[10px] font-mono text-amber-400/90 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-900/60">
              Multi-result information retrieval
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {report.extractedResults!.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-zinc-200 line-clamp-2">
                      {item.name}
                    </span>
                    {item.rating && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-800/70 shrink-0">
                        <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                        {item.rating}
                      </span>
                    )}
                  </div>
                  {item.details && (
                    <p className="text-[11px] text-zinc-400 line-clamp-2 font-mono">
                      {item.details}
                    </p>
                  )}
                </div>

                {item.source && (
                  <div className="mt-2 pt-1 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span className="truncate">{item.source}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rationale / Summary Text */}
      {report.summary && (
        <div className="p-3 rounded-md bg-zinc-950/40 border border-zinc-800/60 text-xs">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Agent Conclusion &amp; Summary
          </div>
          <div className="font-mono text-zinc-300 whitespace-pre-line leading-relaxed">
            {report.summary}
          </div>
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { FileText, ClipboardList } from 'lucide-react';
import { AuditReport } from '../types/index.ts';

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
  return (
    <div
      id="audit-report-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            AUDIT REPORT
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          Executive Summary
        </span>
      </div>

      <div className="p-3 mb-3 rounded-md bg-zinc-950/40 border border-zinc-800/60 flex items-center gap-2.5">
        <ClipboardList className="h-4 w-4 text-zinc-500 shrink-0" />
        <p className="text-xs text-zinc-400">
          Run an agent audit to generate a report.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
        {/* Goal */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60 lg:col-span-2">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Goal
          </div>
          <div className="font-mono text-zinc-500 truncate" title={report.goal || 'None'}>
            {report.goal || '—'}
          </div>
        </div>

        {/* Status */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Status
          </div>
          <div className="font-mono text-zinc-500">
            {report.status || '—'}
          </div>
        </div>

        {/* Total Steps */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Total Steps
          </div>
          <div className="font-mono text-zinc-500">
            {report.totalSteps !== null ? report.totalSteps : '—'}
          </div>
        </div>

        {/* Accessibility Findings */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            Accessibility Findings
          </div>
          <div className="font-mono text-zinc-500">
            {report.accessibilityFindings !== null ? report.accessibilityFindings : '—'}
          </div>
        </div>

        {/* UX Friction Findings */}
        <div className="p-2.5 rounded bg-zinc-950/50 border border-zinc-800/60 sm:col-span-2 lg:col-span-5">
          <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
            UX Friction Findings
          </div>
          <div className="font-mono text-zinc-500">
            {report.uxFrictionFindings !== null ? report.uxFrictionFindings : '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

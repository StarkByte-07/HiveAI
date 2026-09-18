import React, { useState } from 'react';
import { SearchCheck, Eye, Sparkles, AlertCircle, ShieldAlert, CheckCircle2, ChevronDown, ChevronRight, Code } from 'lucide-react';
import { FindingsSummary, AccessibilityAuditResult, FindingSeverity } from '../types/index.ts';

interface FindingsPanelProps {
  findings?: FindingsSummary;
  auditResult?: AccessibilityAuditResult | null;
  onRunAudit?: () => void;
  isAuditing?: boolean;
}

export const FindingsPanel: React.FC<FindingsPanelProps> = ({
  findings = {
    accessibilityCount: 0,
    uxFrictionCount: 0,
    potentialIssuesCount: 0,
  },
  auditResult = null,
  onRunAudit,
  isAuditing = false,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  const totalViolations = auditResult ? auditResult.totalViolations : findings.accessibilityCount;
  const criticalCount = auditResult?.summary?.critical ?? 0;
  const seriousCount = auditResult?.summary?.serious ?? 0;
  const moderateCount = auditResult?.summary?.moderate ?? 0;
  const minorCount = auditResult?.summary?.minor ?? 0;

  const filteredFindings = (auditResult?.findings || []).filter((f) => {
    if (selectedSeverity === 'all') return true;
    return f.severity === selectedSeverity;
  });

  const getSeverityBadge = (severity: FindingSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-rose-950/80 text-rose-300 border border-rose-800/80">
            Critical
          </span>
        );
      case 'serious':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-950/80 text-amber-300 border border-amber-800/80">
            Serious
          </span>
        );
      case 'moderate':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-yellow-950/70 text-yellow-300 border border-yellow-800/70">
            Moderate
          </span>
        );
      case 'minor':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
            Minor
          </span>
        );
    }
  };

  return (
    <div
      id="findings-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col space-y-4"
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <SearchCheck className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            ACCESSIBILITY AUDIT &amp; FINDINGS
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {onRunAudit && (
            <button
              id="run-accessibility-audit-btn"
              type="button"
              disabled={isAuditing}
              onClick={onRunAudit}
              className="px-2.5 py-1 rounded text-[11px] font-mono font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
            >
              {isAuditing ? 'Auditing...' : 'Run Audit'}
            </button>
          )}
          <span className="text-[11px] font-mono text-zinc-500">
            WCAG 2.1 A/AA + Heuristics
          </span>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Accessibility */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase mb-2">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span className="truncate">Total Violations</span>
          </div>
          <span className="text-2xl font-mono font-bold text-zinc-200 mt-auto">
            {totalViolations}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5">
            detected
          </span>
        </div>

        {/* Critical & Serious */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-400 uppercase mb-2">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span className="truncate">Critical / Serious</span>
          </div>
          <span className="text-2xl font-mono font-bold text-rose-400 mt-auto">
            {criticalCount + seriousCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5">
            {criticalCount} crit, {seriousCount} ser
          </span>
        </div>

        {/* Moderate */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-yellow-400 uppercase mb-2">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            <span className="truncate">Moderate</span>
          </div>
          <span className="text-2xl font-mono font-bold text-yellow-400 mt-auto">
            {moderateCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5">
            usability impact
          </span>
        </div>

        {/* Minor */}
        <div className="p-3 rounded-md bg-zinc-950/50 border border-zinc-800/80 flex flex-col">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 uppercase mb-2">
            <AlertCircle className="h-3.5 w-3.5 text-zinc-400" />
            <span className="truncate">Minor</span>
          </div>
          <span className="text-2xl font-mono font-bold text-zinc-300 mt-auto">
            {minorCount}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 mt-0.5">
            best practices
          </span>
        </div>
      </div>

      {/* Severity Filter Tabs */}
      {auditResult && auditResult.findings.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 overflow-x-auto text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setSelectedSeverity('all')}
            className={`px-2.5 py-1 rounded transition-colors ${
              selectedSeverity === 'all'
                ? 'bg-zinc-800 text-zinc-100 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({auditResult.findings.length})
          </button>
          {criticalCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('critical')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSeverity === 'critical'
                  ? 'bg-rose-950 text-rose-200 font-semibold border border-rose-800'
                  : 'text-rose-400/80 hover:text-rose-300'
              }`}
            >
              Critical ({criticalCount})
            </button>
          )}
          {seriousCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('serious')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSeverity === 'serious'
                  ? 'bg-amber-950 text-amber-200 font-semibold border border-amber-800'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              Serious ({seriousCount})
            </button>
          )}
          {moderateCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('moderate')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSeverity === 'moderate'
                  ? 'bg-yellow-950 text-yellow-200 font-semibold border border-yellow-800'
                  : 'text-yellow-400/80 hover:text-yellow-300'
              }`}
            >
              Moderate ({moderateCount})
            </button>
          )}
          {minorCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSeverity('minor')}
              className={`px-2.5 py-1 rounded transition-colors ${
                selectedSeverity === 'minor'
                  ? 'bg-zinc-800 text-zinc-200 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Minor ({minorCount})
            </button>
          )}
        </div>
      )}

      {/* Findings List */}
      {auditResult && auditResult.findings.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedFindingId === finding.id;
            return (
              <div
                key={finding.id}
                className="p-3 rounded-md bg-zinc-950/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors"
              >
                <div
                  className="flex items-start justify-between gap-2 cursor-pointer select-none"
                  onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                >
                  <div className="flex items-start gap-2 flex-1">
                    <button
                      type="button"
                      className="mt-0.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-zinc-200">
                          {finding.rule}
                        </span>
                        {getSeverityBadge(finding.severity)}
                        {finding.wcagLevel && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                            {finding.wcagLevel}
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500">
                          {finding.source}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed font-sans">
                        {finding.message}
                      </p>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-2.5 text-xs font-mono">
                    {/* Element Selector */}
                    <div>
                      <span className="text-[10px] uppercase text-zinc-500 font-semibold block mb-0.5">
                        Element Selector
                      </span>
                      <code className="text-[11px] text-cyan-300 bg-zinc-900 px-2 py-1 rounded block overflow-x-auto border border-zinc-800">
                        {finding.element}
                      </code>
                    </div>

                    {/* HTML Snippet if present */}
                    {finding.htmlSnippet && (
                      <div>
                        <span className="text-[10px] uppercase text-zinc-500 font-semibold block mb-0.5">
                          HTML Snippet
                        </span>
                        <pre className="text-[11px] text-zinc-400 bg-zinc-900/90 p-2 rounded block overflow-x-auto border border-zinc-800">
                          {finding.htmlSnippet}
                        </pre>
                      </div>
                    )}

                    {/* Evidence */}
                    <div>
                      <span className="text-[10px] uppercase text-zinc-500 font-semibold block mb-0.5">
                        Evidence / Impact
                      </span>
                      <p className="text-zinc-300 bg-zinc-900/40 p-2 rounded border border-zinc-800/60 leading-relaxed font-sans text-xs">
                        {finding.evidence}
                      </p>
                    </div>

                    {/* Recommendation */}
                    <div>
                      <span className="text-[10px] uppercase text-emerald-400 font-semibold block mb-0.5">
                        Remediation Recommendation
                      </span>
                      <p className="text-emerald-300/90 bg-emerald-950/30 p-2 rounded border border-emerald-900/40 leading-relaxed font-sans text-xs">
                        {finding.recommendation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : auditResult && auditResult.findings.length === 0 ? (
        <div className="p-4 rounded-md bg-emerald-950/20 border border-emerald-900/40 text-center flex flex-col items-center gap-1.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <p className="text-xs font-medium text-emerald-300">
            No accessibility violations detected
          </p>
          <p className="text-[11px] text-zinc-400 font-mono">
            Page conforms to evaluated WCAG 2.1 A/AA standards and custom black-box heuristics.
          </p>
        </div>
      ) : (
        <div className="p-3.5 rounded bg-zinc-950/40 border border-zinc-800/60 text-center">
          <p className="text-xs text-zinc-400 font-mono">
            Autonomous accessibility audit will execute automatically when the agent completes its run.
          </p>
        </div>
      )}
    </div>
  );
};

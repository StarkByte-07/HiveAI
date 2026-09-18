import React, { useState } from 'react';
import { Eye, Globe, ExternalLink, RefreshCw, Layers, AlignLeft, Code2, MousePointerClick, Link as LinkIcon, Edit3 } from 'lucide-react';
import { PageObservation } from '../types/index.ts';

interface PageObservationPanelProps {
  observation: PageObservation | null;
  onRefreshObservation?: () => void;
  isObserving?: boolean;
}

export const PageObservationPanel: React.FC<PageObservationPanelProps> = ({
  observation,
  onRefreshObservation,
  isObserving = false,
}) => {
  const [activeTab, setActiveTab] = useState<'interactive' | 'text' | 'json'>('interactive');
  const [elementFilter, setElementFilter] = useState<'all' | 'button' | 'link' | 'textbox'>('all');

  if (!observation) {
    return (
      <div
        id="page-observation-panel"
        className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-cyan-400" />
            <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
              PAGE OBSERVATION
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Black-Box Structural State
          </span>
        </div>

        <div className="min-h-[140px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800/80 rounded-md bg-zinc-950/30">
          <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-2.5">
            <Eye className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-zinc-300">
            No page observation yet.
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-sm leading-relaxed">
            Run the agent to open a target application and extract standard observable UI elements.
          </p>
        </div>
      </div>
    );
  }

  const { stats, interactiveElements, visibleText, headings } = observation;

  const filteredElements = interactiveElements.filter((el) => {
    if (elementFilter === 'all') return true;
    if (elementFilter === 'textbox') {
      return el.role === 'textbox' || el.role === 'searchbox' || el.role === 'combobox';
    }
    return el.role === elementFilter;
  });

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'button':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
      case 'link':
        return 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60';
      case 'textbox':
      case 'searchbox':
        return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
      case 'checkbox':
      case 'radio':
        return 'bg-purple-950/80 text-purple-400 border-purple-800/60';
      default:
        return 'bg-zinc-850 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div
      id="page-observation-panel"
      className="p-4 sm:p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col space-y-4"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyan-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            PAGE OBSERVATION
          </h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-950/70 text-cyan-300 border border-cyan-800/60">
            {stats.totalInteractiveCount} Elements Observed
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshObservation && (
            <button
              type="button"
              id="re-observe-btn"
              onClick={onRefreshObservation}
              disabled={isObserving}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-mono transition-colors disabled:opacity-50"
              title="Inspect current active page again"
            >
              <RefreshCw className={`h-3 w-3 text-cyan-400 ${isObserving ? 'animate-spin' : ''}`} />
              {isObserving ? 'Observing...' : 'Re-inspect Page'}
            </button>
          )}
          <span className="text-[11px] font-mono text-zinc-500">
            {observation.timestamp}
          </span>
        </div>
      </div>

      {/* Target Metadata Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-950/70 border border-zinc-800 text-xs font-mono">
        <div className="space-y-1 truncate">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">PAGE TITLE</span>
          <p className="text-zinc-100 font-semibold truncate" title={observation.title}>
            {observation.title || 'Untitled'}
          </p>
        </div>

        <div className="space-y-1 truncate">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">TARGET URL</span>
          <a
            href={observation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 truncate flex items-center gap-1"
          >
            <span className="truncate">{observation.url}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('interactive')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === 'interactive'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="h-3 w-3 text-cyan-400" />
            Interactive Elements ({stats.totalInteractiveCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === 'text'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlignLeft className="h-3 w-3 text-emerald-400" />
            Visible Text ({visibleText.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono transition-colors ${
              activeTab === 'json'
                ? 'bg-zinc-800 text-zinc-100 font-semibold border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Code2 className="h-3 w-3 text-amber-400" />
            Raw Observation
          </button>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE ELEMENTS */}
      {activeTab === 'interactive' && (
        <div className="space-y-3">
          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 text-xs font-mono flex-wrap">
            <span className="text-zinc-500 text-[11px] mr-1">Filter:</span>
            <button
              type="button"
              onClick={() => setElementFilter('all')}
              className={`px-2 py-0.5 rounded text-[11px] border ${
                elementFilter === 'all'
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              All ({interactiveElements.length})
            </button>
            <button
              type="button"
              onClick={() => setElementFilter('button')}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 ${
                elementFilter === 'button'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <MousePointerClick className="h-2.5 w-2.5" />
              Buttons ({stats.buttonCount})
            </button>
            <button
              type="button"
              onClick={() => setElementFilter('link')}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 ${
                elementFilter === 'link'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <LinkIcon className="h-2.5 w-2.5" />
              Links ({stats.linkCount})
            </button>
            <button
              type="button"
              onClick={() => setElementFilter('textbox')}
              className={`px-2 py-0.5 rounded text-[11px] border flex items-center gap-1 ${
                elementFilter === 'textbox'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Edit3 className="h-2.5 w-2.5" />
              Inputs ({stats.inputCount})
            </button>
          </div>

          {/* Elements List */}
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1 divide-y divide-zinc-850">
            {filteredElements.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-4 text-center">
                No interactive elements matching this filter.
              </p>
            ) : (
              filteredElements.map((el) => (
                <div
                  key={el.id}
                  className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border shrink-0 ${getRoleBadgeStyle(
                        el.role
                      )}`}
                    >
                      {el.role}
                    </span>
                    <span className="text-zinc-200 font-medium truncate" title={el.name}>
                      {el.name}
                    </span>
                    {el.text && el.text !== el.name && (
                      <span className="text-zinc-500 text-[11px] truncate hidden md:inline">
                        "{el.text}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 shrink-0">
                    <code className="px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-850">
                      {el.elementType}
                    </code>
                    {el.state?.disabled && (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        disabled
                      </span>
                    )}
                    {el.state?.checked && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                        checked
                      </span>
                    )}
                    {el.state?.value && (
                      <span className="text-zinc-400">
                        val: "{el.state.value}"
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VISIBLE TEXT */}
      {activeTab === 'text' && (
        <div className="space-y-3">
          {headings && headings.length > 0 && (
            <div className="p-2.5 rounded bg-zinc-950/70 border border-zinc-800 space-y-1">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                PAGE HEADINGS ({headings.length})
              </span>
              <div className="space-y-1">
                {headings.map((heading, idx) => (
                  <div key={idx} className="text-xs font-mono text-zinc-200 flex items-start gap-2">
                    <span className="text-cyan-500 font-bold shrink-0">#</span>
                    <span>{heading}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 rounded bg-zinc-950/70 border border-zinc-800 space-y-2 max-h-[300px] overflow-y-auto">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
              VISIBLE TEXT CONTENT ({visibleText.length} BLOCKS)
            </span>
            {visibleText.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No visible paragraphs identified.</p>
            ) : (
              visibleText.map((block, idx) => (
                <p key={idx} className="text-xs text-zinc-300 font-sans leading-relaxed border-b border-zinc-900 pb-1.5 last:border-0">
                  {block}
                </p>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RAW OBSERVATION JSON */}
      {activeTab === 'json' && (
        <div className="relative">
          <pre className="p-3 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-[320px] overflow-auto leading-relaxed">
            {JSON.stringify(
              {
                url: observation.url,
                title: observation.title,
                stats: observation.stats,
                headings: observation.headings,
                visibleTextSample: observation.visibleText.slice(0, 5),
                interactiveElements: observation.interactiveElements.slice(0, 10),
                totalInteractiveElements: observation.interactiveElements.length,
                hasScreenshot: Boolean(observation.screenshotBase64 || observation.screenshotUrl),
              },
              null,
              2
            )}
          </pre>
          <div className="text-[10px] font-mono text-zinc-500 pt-1 text-right">
            Structured representation ready for Gemini agent consumption in Phase 4
          </div>
        </div>
      )}
    </div>
  );
};

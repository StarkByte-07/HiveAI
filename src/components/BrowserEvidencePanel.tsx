import React, { useState } from 'react';
import { Camera, Image as ImageIcon, ExternalLink, Maximize2, X } from 'lucide-react';

interface BrowserEvidencePanelProps {
  screenshotUrl?: string | null;
  pageTitle?: string | null;
  targetUrl?: string | null;
  timestamp?: string | null;
}

export const BrowserEvidencePanel: React.FC<BrowserEvidencePanelProps> = ({
  screenshotUrl,
  pageTitle,
  targetUrl,
  timestamp,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div
      id="browser-evidence-panel"
      className="p-4 rounded-lg bg-zinc-900/60 border border-zinc-800 flex flex-col"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-zinc-400" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-zinc-200 uppercase">
            BROWSER EVIDENCE
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          {screenshotUrl ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Live Chromium Capture
            </span>
          ) : (
            'Chromium Visual State'
          )}
        </span>
      </div>

      {!screenshotUrl ? (
        <div className="min-h-[140px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800/80 rounded-md bg-zinc-950/30">
          <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-2.5">
            <ImageIcon className="h-4 w-4" />
          </div>
          <p className="text-xs font-medium text-zinc-300">
            No browser evidence yet.
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-sm leading-relaxed">
            Screenshots and browser evidence will appear here during an audit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Metadata bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-zinc-400 px-1">
            <div className="truncate">
              <span className="text-zinc-500">Subject: </span>
              <span className="text-zinc-200 font-semibold">{pageTitle || targetUrl}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {timestamp && <span className="text-zinc-500">Captured: {timestamp}</span>}
              <button
                type="button"
                id="expand-screenshot-btn"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[10px] transition-colors"
                title="Expand screenshot"
              >
                <Maximize2 className="h-2.5 w-2.5" />
                Expand
              </button>
            </div>
          </div>

          {/* Screenshot Preview Card */}
          <div
            className="relative rounded-md overflow-hidden border border-zinc-800 bg-zinc-950/80 group cursor-pointer"
            onClick={() => setIsModalOpen(true)}
          >
            <img
              src={screenshotUrl}
              alt={pageTitle ? `Screenshot of ${pageTitle}` : 'Browser viewport screenshot'}
              className="w-full h-auto max-h-[380px] object-contain object-top mx-auto"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="px-3 py-1.5 rounded-md bg-zinc-900/90 text-zinc-200 text-xs font-mono font-medium border border-zinc-700 shadow-lg flex items-center gap-1.5">
                <Maximize2 className="h-3.5 w-3.5" /> Click to enlarge
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Modal */}
      {isModalOpen && screenshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-zinc-200 uppercase">
                  Chromium Viewport Screenshot
                </span>
                {pageTitle && (
                  <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                    — {pageTitle}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 overflow-auto flex-1 flex items-center justify-center bg-zinc-950">
              <img
                src={screenshotUrl}
                alt="Full viewport preview"
                className="max-w-full max-h-[75vh] object-contain rounded border border-zinc-800/80"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

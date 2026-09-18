import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface BrowserEvidencePanelProps {
  evidenceCount?: number;
}

export const BrowserEvidencePanel: React.FC<BrowserEvidencePanelProps> = ({
  evidenceCount = 0,
}) => {
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
          Chromium Visual State
        </span>
      </div>

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
    </div>
  );
};

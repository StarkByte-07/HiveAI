import React from 'react';
import { Target, Sparkles } from 'lucide-react';

interface TestingGoalProps {
  goal: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const EXAMPLE_GOAL = 'Find blue running shoes under ₹8,000 and reach the product details page.';

export const TestingGoal: React.FC<TestingGoalProps> = ({
  goal,
  onChange,
  disabled = false,
}) => {
  return (
    <div id="testing-goal-section" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor="testing-goal-input"
          className="text-xs font-mono font-semibold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5"
        >
          <Target className="h-3.5 w-3.5 text-zinc-400" />
          TESTING GOAL
        </label>
        <span className="text-[11px] font-mono text-zinc-500">
          Natural-Language Intent
        </span>
      </div>

      <div className="relative">
        <textarea
          id="testing-goal-input"
          rows={3}
          value={goal}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Describe what a real user should be able to accomplish..."
          disabled={disabled}
          className="w-full px-3.5 py-2.5 rounded-md bg-zinc-900/90 border border-zinc-700/80 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 focus:border-emerald-500/80 transition-colors shadow-inner resize-y leading-relaxed font-sans"
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs text-zinc-400">
          Describe the user goal. The agent will eventually discover the interaction path autonomously.
        </p>
        <div className="flex items-start gap-1.5 text-[11px] text-zinc-500">
          <span className="font-mono text-zinc-400 shrink-0">Example:</span>
          <span className="italic text-zinc-400">
            "{EXAMPLE_GOAL}"
          </span>
          <button
            type="button"
            onClick={() => onChange(EXAMPLE_GOAL)}
            className="ml-auto text-[10px] font-mono text-zinc-400 hover:text-emerald-400 underline decoration-dotted transition-colors shrink-0"
            title="Populate with example goal"
          >
            Use example
          </button>
        </div>
      </div>
    </div>
  );
};

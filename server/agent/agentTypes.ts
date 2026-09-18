import type { PageObservation } from '../observation/observationTypes.ts';
import type { AccessibilityAuditResult } from '../audit/accessibilityAuditor.ts';

export type GoalIntentType = 
  | 'NAVIGATION' 
  | 'SEARCH' 
  | 'INFORMATION_RETRIEVAL' 
  | 'ACTION' 
  | 'VERIFICATION';

export interface ExtractedResultItem {
  name: string;
  rating?: string;
  details?: string;
  source?: string;
  url?: string;
  metadata?: Record<string, any>;
}

export type AgentActionType = 
  | 'click' 
  | 'type' 
  | 'scroll' 
  | 'wait' 
  | 'back' 
  | 'navigate' 
  | 'finish';

export interface AgentAction {
  action: AgentActionType;
  target?: string;
  elementId?: string;
  value?: string;
  text?: string;
  direction?: 'up' | 'down';
  milliseconds?: number;
  url?: string;
  explanation?: string;
  reason?: string;
  intentType?: GoalIntentType;
  extractedResults?: ExtractedResultItem[];
}

export interface AgentHistoryItem {
  stepNumber: number;
  action: AgentAction;
  result: 'success' | 'failed';
  message: string;
  urlAfterAction?: string;
}

export interface AgentReasoningInput {
  goal: string;
  currentStep: number;
  maxSteps: number;
  observation: PageObservation;
  history: AgentHistoryItem[];
  cumulativeResults?: ExtractedResultItem[];
  intentType?: GoalIntentType;
}

export type AgentStepEventType = 
  | 'NAVIGATE' 
  | 'OBSERVE' 
  | 'REASON' 
  | 'ACTION' 
  | 'VALIDATE'
  | 'FINISH' 
  | 'ERROR';

export interface AgentStepEvent {
  stepNumber: number;
  type: AgentStepEventType;
  status: 'starting' | 'running' | 'success' | 'failed';
  description: string;
  action?: AgentAction;
  actionType?: AgentActionType;
  target?: string;
  explanation?: string;
  url?: string;
  timestamp: string;
  intentType?: GoalIntentType;
  extractedResults?: ExtractedResultItem[];
  rejectedResults?: Array<{ item: ExtractedResultItem; reason: string }>;
  unmetConstraints?: string[];
  result?: {
    success: boolean;
    message: string;
    error?: string;
  };
  observation?: PageObservation;
  accessibilityAudit?: AccessibilityAuditResult;
  isTerminal?: boolean;
}

export interface AgentExecutionResult {
  success: boolean;
  message: string;
  error?: string;
  currentUrl?: string;
  currentTitle?: string;
}

export interface AgentLoopConfig {
  maxSteps?: number;
  actionTimeoutMs?: number;
  onEvent?: (event: AgentStepEvent) => void;
}

export interface AgentLoopResult {
  success: boolean;
  status: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'STOPPED' | 'MAX_STEPS_REACHED';
  goalSatisfied: boolean;
  goal: string;
  intentType?: GoalIntentType;
  extractedResults?: ExtractedResultItem[];
  rejectedResults?: Array<{ item: ExtractedResultItem; reason: string }>;
  unmetConstraints?: string[];
  accessibilityAudit?: AccessibilityAuditResult;
  totalSteps: number;
  journey: AgentStepEvent[];
  finalObservation?: PageObservation | null;
  message: string;
  error?: string;
}

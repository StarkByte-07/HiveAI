import type { PageObservation } from '../observation/observationTypes.ts';

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
  value?: string;
  direction?: 'up' | 'down';
  url?: string;
  explanation?: string;
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
}

export type AgentStepEventType = 
  | 'NAVIGATE' 
  | 'OBSERVE' 
  | 'REASON' 
  | 'ACTION' 
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
  observation?: PageObservation;
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
  status: 'COMPLETED' | 'MAX_STEPS_REACHED' | 'FAILED' | 'STOPPED';
  goal: string;
  totalSteps: number;
  journey: AgentStepEvent[];
  finalObservation?: PageObservation | null;
  message: string;
  error?: string;
}

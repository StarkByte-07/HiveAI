/**
 * Core type definitions for FlowSentry / HiveAI (Autonomous UI Auditor).
 * Phase 4: Agent Reasoning + Autonomous Action
 */

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

export type AgentRuntimeState = 
  | 'READY' 
  | 'STARTING BROWSER' 
  | 'BROWSER LAUNCHED' 
  | 'TARGET PAGE OPENED' 
  | 'OBSERVING PAGE'
  | 'PAGE OBSERVED'
  | 'REASONING'
  | 'EXECUTING ACTION'
  | 'ACTION COMPLETED'
  | 'ACTION FAILED'
  | 'GOAL COMPLETED'
  | 'AGENT FAILED'
  | 'STOPPED'
  | 'ERROR';

export interface AgentActivity {
  phase: 'NAVIGATE' | 'OBSERVE' | 'REASON' | 'ACT' | 'COMPLETE' | 'IDLE' | 'ERROR';
  headline: string;
  detail?: string;
  explanation?: string;
  timestamp?: string;
  extractedResults?: ExtractedResultItem[];
  intentType?: GoalIntentType;
}

export interface AgentStatus {
  state: AgentRuntimeState;
  browserStatus: 'Not launched' | 'Launching' | 'Launching...' | 'Launched' | 'Active' | 'Closed' | 'Error' | string;
  agentStatus: 'Idle' | 'Starting' | 'Starting...' | 'Ready' | 'Observing...' | 'Reasoning...' | 'Executing...' | 'Completed' | 'Error' | string;
  currentStep: number | null;
  currentUrl: string | null;
  pageTitle?: string | null;
  errorMessage?: string | null;
  isHeadlessFallback?: boolean;
  activity?: AgentActivity | null;
  isRunning?: boolean;
  intentType?: GoalIntentType;
  extractedResults?: ExtractedResultItem[];
}

export interface InteractiveElementState {
  disabled?: boolean;
  checked?: boolean;
  expanded?: boolean;
  value?: string;
}

export interface InteractiveElement {
  id: string;
  role: string;
  name: string;
  text?: string;
  elementType: string;
  state?: InteractiveElementState;
}

export interface ObservationStats {
  totalInteractiveCount: number;
  buttonCount: number;
  linkCount: number;
  inputCount: number;
  otherCount: number;
}

export interface PageObservation {
  url: string;
  title: string;
  headings: string[];
  visibleText: string[];
  contentItems?: string[];
  interactiveElements: InteractiveElement[];
  screenshotBase64?: string;
  screenshotUrl?: string;
  timestamp: string;
  stats: ObservationStats;
}

export interface AgentStartResponse {
  success: boolean;
  status: AgentRuntimeState;
  currentUrl?: string;
  title?: string;
  observation?: PageObservation | null;
  message: string;
  error?: string;
  isHeadlessFallback?: boolean;
}

export interface ObservationResponse {
  success: boolean;
  observation?: PageObservation;
  message?: string;
  error?: string;
}

export type JourneyActionType = 
  | 'navigate' 
  | 'observe' 
  | 'reason' 
  | 'action' 
  | 'click' 
  | 'type' 
  | 'scroll' 
  | 'wait' 
  | 'back' 
  | 'filter' 
  | 'assert' 
  | 'inspect' 
  | 'finish' 
  | 'error';

export interface JourneyStep {
  stepNumber: number;
  action: JourneyActionType;
  description: string;
  targetSelector?: string;
  targetElementText?: string;
  actionType?: string;
  target?: string;
  value?: string;
  explanation?: string;
  url?: string;
  timestamp?: string;
  status?: 'pending' | 'running' | 'success' | 'failed';
  intentType?: GoalIntentType;
  extractedResults?: ExtractedResultItem[];
}

export type FindingCategory = 'accessibility' | 'ux_friction' | 'potential_issue';
export type FindingSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  elementSelector?: string;
  wcagCriterion?: string;
  impact?: string;
}

export interface AccessibilityFinding {
  id: string;
  rule: string;
  category: string;
  severity: FindingSeverity;
  element: string;
  message: string;
  evidence: string;
  recommendation: string;
  source: 'axe-core' | 'dom-heuristic' | 'accessibility-tree';
  wcagLevel?: string;
  htmlSnippet?: string;
}

export interface AccessibilityAuditResult {
  url: string;
  timestamp: string;
  totalViolations: number;
  findings: AccessibilityFinding[];
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface FindingsSummary {
  accessibilityCount: number;
  uxFrictionCount: number;
  potentialIssuesCount: number;
}

export interface BrowserEvidenceItem {
  id: string;
  stepNumber: number;
  title: string;
  screenshotUrl?: string;
  timestamp?: string;
}

export interface AuditReport {
  goal: string | null;
  status: 'Not started' | 'In progress' | 'Completed' | 'Failed' | null;
  totalSteps: number | null;
  accessibilityFindings: number | null;
  uxFrictionFindings: number | null;
  generatedAt?: string | null;
  intentType?: GoalIntentType | null;
  extractedResults?: ExtractedResultItem[] | null;
  accessibilityAudit?: AccessibilityAuditResult | null;
  summary?: string | null;
}

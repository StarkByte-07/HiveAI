/**
 * Core type definitions for FlowSentry (Autonomous UI Auditor).
 * Phase 3: Observation Engine & Black-Box Browser State.
 */

export type AgentRuntimeState = 
  | 'READY' 
  | 'STARTING BROWSER' 
  | 'BROWSER LAUNCHED' 
  | 'TARGET PAGE OPENED' 
  | 'OBSERVING PAGE'
  | 'PAGE OBSERVED'
  | 'ERROR';

export interface AgentStatus {
  state: AgentRuntimeState;
  browserStatus: 'Not launched' | 'Launching' | 'Launching...' | 'Launched' | 'Active' | 'Closed' | 'Error' | string;
  agentStatus: 'Idle' | 'Starting' | 'Starting...' | 'Ready' | 'Observing...' | 'Error' | string;
  currentStep: number | null;
  currentUrl: string | null;
  pageTitle?: string | null;
  errorMessage?: string | null;
  isHeadlessFallback?: boolean;
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

export type JourneyActionType = 'navigate' | 'observe' | 'click' | 'type' | 'filter' | 'scroll' | 'assert' | 'inspect';

export interface JourneyStep {
  stepNumber: number;
  action: JourneyActionType;
  description: string;
  targetSelector?: string;
  targetElementText?: string;
  url?: string;
  timestamp?: string;
  status?: 'pending' | 'success' | 'failed';
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
}

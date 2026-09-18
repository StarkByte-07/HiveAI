/**
 * Core type definitions for Autonomous UI Auditor (Phase 1).
 * Prepared for future local browser agent integration (Playwright + Gemini).
 */

export type AgentRuntimeState = 
  | 'READY' 
  | 'STARTING BROWSER' 
  | 'BROWSER LAUNCHED' 
  | 'TARGET PAGE OPENED' 
  | 'ERROR';

export interface AgentStatus {
  state: AgentRuntimeState;
  browserStatus: 'Not launched' | 'Launching' | 'Launching...' | 'Launched' | 'Active' | 'Closed' | 'Error' | string;
  agentStatus: 'Idle' | 'Starting' | 'Starting...' | 'Ready' | 'Error' | string;
  currentStep: number | null;
  currentUrl: string | null;
  pageTitle?: string | null;
  errorMessage?: string | null;
  isHeadlessFallback?: boolean;
}

export interface AgentStartResponse {
  success: boolean;
  status: AgentRuntimeState;
  currentUrl?: string;
  title?: string;
  message: string;
  error?: string;
  isHeadlessFallback?: boolean;
}

export type JourneyActionType = 'navigate' | 'click' | 'type' | 'filter' | 'scroll' | 'assert' | 'inspect';

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

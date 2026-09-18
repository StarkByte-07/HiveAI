/**
 * Observation Engine Types
 * Standard browser-observable representations for FlowSentry (Phase 3).
 * Operates purely as a black-box inspection layer.
 */

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

export interface ObservationResponse {
  success: boolean;
  observation?: PageObservation;
  message?: string;
  error?: string;
}

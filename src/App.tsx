/**
 * FLOWSENTRY
 * Hackathon PoC for PRAGYAAN 2.0 / Clash of Devs at KMIT
 * Problem Statement: P8 — Autonomous Agentic Black-Box UI/UX & Accessibility Testing Framework
 * 
 * Phase 3: Observation Engine
 * Inspects target webpage via standard browser accessibility and DOM APIs.
 * Pure black-box inspection: interactive elements, visible text, and real screenshot.
 */

import React, { useState } from 'react';
import { Header } from './components/Header.tsx';
import { TargetApplication } from './components/TargetApplication.tsx';
import { TestingGoal } from './components/TestingGoal.tsx';
import { RunAgentButton } from './components/RunAgentButton.tsx';
import { AgentStatusPanel } from './components/AgentStatusPanel.tsx';
import { PageObservationPanel } from './components/PageObservationPanel.tsx';
import { JourneyPanel } from './components/JourneyPanel.tsx';
import { FindingsPanel } from './components/FindingsPanel.tsx';
import { BrowserEvidencePanel } from './components/BrowserEvidencePanel.tsx';
import { AuditReportPanel } from './components/AuditReportPanel.tsx';
import {
  AgentStatus,
  FindingsSummary,
  AuditReport,
  JourneyStep,
  AgentStartResponse,
  PageObservation,
  ObservationResponse,
} from './types/index.ts';

export default function App() {
  // Controlled input states
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [testingGoal, setTestingGoal] = useState<string>('');
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [isObserving, setIsObserving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Agent & Browser Status
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    state: 'READY',
    browserStatus: 'Not launched',
    agentStatus: 'Idle',
    currentStep: null,
    currentUrl: null,
    pageTitle: null,
  });

  // Phase 3: Real Page Observation State
  const [pageObservation, setPageObservation] = useState<PageObservation | null>(null);

  // Genuine journey trace (genuine events only)
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([]);

  // Phase 3 keeps zero findings (observation only, not analysis)
  const [findings] = useState<FindingsSummary>({
    accessibilityCount: 0,
    uxFrictionCount: 0,
    potentialIssuesCount: 0,
  });

  // Phase 3 keeps initial empty audit report
  const [auditReport] = useState<AuditReport>({
    goal: null,
    status: null,
    totalSteps: null,
    accessibilityFindings: null,
    uxFrictionFindings: null,
  });

  const handleRunAgent = async () => {
    if (isLaunching) return;

    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please enter a target web application URL before running the agent.');
      setStatusMessage(null);
      return;
    }

    // Auto-format protocol if omitted
    let formattedUrl = trimmedUrl;
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      formattedUrl = `https://${trimmedUrl}`;
      setTargetUrl(formattedUrl);
    }

    try {
      new URL(formattedUrl);
    } catch {
      setErrorMessage('Please enter a valid HTTP/HTTPS web address (e.g. https://example.com).');
      setStatusMessage(null);
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsLaunching(true);

    setAgentStatus({
      state: 'STARTING BROWSER',
      browserStatus: 'Launching...',
      agentStatus: 'Starting...',
      currentStep: null,
      currentUrl: formattedUrl,
      pageTitle: null,
    });

    try {
      const response = await fetch('/api/agent/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUrl: formattedUrl,
          goal: testingGoal.trim() || undefined,
        }),
      });

      const data: AgentStartResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to launch browser or navigate to target URL.');
      }

      const browserDisplay = data.isHeadlessFallback
        ? 'Active (Chromium - Container)'
        : 'Active (Chromium - Visible Window)';

      const steps: JourneyStep[] = [
        {
          stepNumber: 1,
          action: 'navigate',
          description: `Browser launched and target page opened: "${data.title || formattedUrl}"`,
          url: data.currentUrl || formattedUrl,
          status: 'success',
          timestamp: new Date().toLocaleTimeString(),
        },
      ];

      // If observation was automatically captured
      if (data.observation) {
        setPageObservation(data.observation);
        steps.push({
          stepNumber: 2,
          action: 'observe',
          description: `Observed page: extracted ${data.observation.stats.totalInteractiveCount} interactive elements (${data.observation.stats.buttonCount} buttons, ${data.observation.stats.linkCount} links, ${data.observation.stats.inputCount} inputs) and captured live screenshot`,
          url: data.observation.url,
          status: 'success',
          timestamp: data.observation.timestamp,
        });

        setAgentStatus({
          state: 'PAGE OBSERVED',
          browserStatus: browserDisplay,
          agentStatus: 'Ready',
          currentStep: 2,
          currentUrl: data.currentUrl || formattedUrl,
          pageTitle: data.title || data.observation.title || null,
          isHeadlessFallback: data.isHeadlessFallback,
        });
      } else {
        setAgentStatus({
          state: 'TARGET PAGE OPENED',
          browserStatus: browserDisplay,
          agentStatus: 'Ready',
          currentStep: 1,
          currentUrl: data.currentUrl || formattedUrl,
          pageTitle: data.title || null,
          isHeadlessFallback: data.isHeadlessFallback,
        });
      }

      setJourneySteps(steps);
      setStatusMessage(data.message);
    } catch (err: any) {
      console.error('[Agent Launch Error]', err);
      const displayError = err?.message || 'Failed to connect to backend server. Please check the server logs.';
      setErrorMessage(displayError);

      setAgentStatus({
        state: 'ERROR',
        browserStatus: 'Error',
        agentStatus: 'Error',
        currentStep: null,
        currentUrl: formattedUrl,
        pageTitle: null,
        errorMessage: displayError,
      });
    } finally {
      setIsLaunching(false);
    }
  };

  /**
   * Manual re-observation control (allows on-demand re-inspection of current active page)
   */
  const handleRefreshObservation = async () => {
    if (isObserving) return;
    setIsObserving(true);
    setErrorMessage(null);

    setAgentStatus((prev) => ({
      ...prev,
      state: 'OBSERVING PAGE',
      agentStatus: 'Observing...',
    }));

    try {
      const response = await fetch('/api/agent/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data: ObservationResponse = await response.json();

      if (!response.ok || !data.success || !data.observation) {
        throw new Error(data.message || data.error || 'Failed to inspect current page.');
      }

      setPageObservation(data.observation);

      setJourneySteps((prev) => {
        const nextStepNum = prev.length + 1;
        return [
          ...prev,
          {
            stepNumber: nextStepNum,
            action: 'observe',
            description: `Re-inspected page: ${data.observation?.stats.totalInteractiveCount} interactive elements, ${data.observation?.visibleText.length} text blocks observed`,
            url: data.observation?.url,
            status: 'success',
            timestamp: data.observation?.timestamp,
          },
        ];
      });

      setAgentStatus((prev) => ({
        ...prev,
        state: 'PAGE OBSERVED',
        agentStatus: 'Ready',
        currentStep: 2,
        currentUrl: data.observation?.url || prev.currentUrl,
        pageTitle: data.observation?.title || prev.pageTitle,
      }));

      setStatusMessage(data.message || 'Page observed successfully.');
    } catch (err: any) {
      console.error('[Re-observe Error]', err);
      setErrorMessage(err?.message || 'Failed to re-observe active page.');
      setAgentStatus((prev) => ({
        ...prev,
        state: prev.currentUrl ? 'TARGET PAGE OPENED' : 'ERROR',
        agentStatus: 'Error',
      }));
    } finally {
      setIsObserving(false);
    }
  };

  const handleDismissMessages = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <Header />

      {/* Main Dashboard Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Configuration Panel (Target Application + Testing Goal + Run Agent) */}
        <section
          id="configuration-panel"
          className="p-5 sm:p-6 rounded-xl bg-zinc-900/40 border border-zinc-800 shadow-sm backdrop-blur-sm space-y-5"
        >
          <div className="grid grid-cols-1 gap-5">
            {/* Target Application Input */}
            <TargetApplication
              url={targetUrl}
              onChange={setTargetUrl}
              disabled={isLaunching || isObserving}
            />

            {/* Testing Goal Input */}
            <TestingGoal
              goal={testingGoal}
              onChange={setTestingGoal}
              disabled={isLaunching || isObserving}
            />
          </div>

          {/* Action Trigger */}
          <div className="pt-2 border-t border-zinc-800/80">
            <RunAgentButton
              onRunAgent={handleRunAgent}
              isLaunching={isLaunching}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
              onDismissMessage={handleDismissMessages}
            />
          </div>
        </section>

        {/* Agent Status Panel */}
        <section>
          <AgentStatusPanel status={agentStatus} />
        </section>

        {/* Phase 3: Page Observation Panel */}
        <section>
          <PageObservationPanel
            observation={pageObservation}
            onRefreshObservation={handleRefreshObservation}
            isObserving={isObserving}
          />
        </section>

        {/* Middle Dual Panels: Live Journey & Findings */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <JourneyPanel steps={journeySteps} />
          <FindingsPanel findings={findings} />
        </section>

        {/* Browser Evidence Panel (Connected to real Playwright screenshot) */}
        <section>
          <BrowserEvidencePanel
            screenshotUrl={pageObservation?.screenshotBase64 || (pageObservation ? pageObservation.screenshotUrl : null)}
            pageTitle={pageObservation?.title}
            targetUrl={pageObservation?.url}
            timestamp={pageObservation?.timestamp}
          />
        </section>

        {/* Audit Report Panel (Empty state preserved for Phase 3) */}
        <section>
          <AuditReportPanel report={auditReport} />
        </section>
      </main>

      {/* Developer / Technical Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            FLOWSENTRY • PRAGYAAN 2.0 / Clash of Devs Hackathon @ KMIT
          </span>
          <span className="text-zinc-500">
            P8: Autonomous Agentic Black-Box UI/UX &amp; Accessibility Testing (Phase 3: Observation Engine)
          </span>
        </div>
      </footer>
    </div>
  );
}

/**
 * AUTONOMOUS UI AUDITOR
 * Hackathon PoC for PRAGYAAN 2.0 / Clash of Devs at KMIT
 * Problem Statement: P8 — Autonomous Agentic Black-Box UI/UX & Accessibility Testing Framework
 * 
 * Phase 2: Browser Runtime & Target Navigation
 * Real Playwright Chromium browser launch and target page navigation.
 */

import React, { useState } from 'react';
import { Header } from './components/Header.tsx';
import { TargetApplication } from './components/TargetApplication.tsx';
import { TestingGoal } from './components/TestingGoal.tsx';
import { RunAgentButton } from './components/RunAgentButton.tsx';
import { AgentStatusPanel } from './components/AgentStatusPanel.tsx';
import { JourneyPanel } from './components/JourneyPanel.tsx';
import { FindingsPanel } from './components/FindingsPanel.tsx';
import { BrowserEvidencePanel } from './components/BrowserEvidencePanel.tsx';
import { AuditReportPanel } from './components/AuditReportPanel.tsx';
import { AgentStatus, FindingsSummary, AuditReport, JourneyStep, AgentStartResponse } from './types/index.ts';

export default function App() {
  // Controlled input states
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [testingGoal, setTestingGoal] = useState<string>('');
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Agent & Browser Status (starts in READY state)
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    state: 'READY',
    browserStatus: 'Not launched',
    agentStatus: 'Idle',
    currentStep: null,
    currentUrl: null,
    pageTitle: null,
  });

  // Genuine journey trace (starts empty, receives genuine navigation event upon success)
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([]);

  // Phase 2 keeps zero findings (no fake data)
  const [findings] = useState<FindingsSummary>({
    accessibilityCount: 0,
    uxFrictionCount: 0,
    potentialIssuesCount: 0,
  });

  // Phase 2 keeps initial empty audit report
  const [auditReport] = useState<AuditReport>({
    goal: null,
    status: null,
    totalSteps: null,
    accessibilityFindings: null,
    uxFrictionFindings: null,
  });

  const handleRunAgent = async () => {
    // 1. Prevent duplicate submissions
    if (isLaunching) return;

    // 2. Validate input URL
    const trimmedUrl = targetUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage('Please enter a target web application URL before running the agent.');
      setStatusMessage(null);
      return;
    }

    // Auto-prepend https:// if protocol was omitted
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

    // Clear previous notices and update status progression
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

      // Success: browser launched and target page opened
      const browserDisplay = data.isHeadlessFallback
        ? 'Active (Chromium - Container)'
        : 'Active (Chromium - Visible Window)';

      setAgentStatus({
        state: 'TARGET PAGE OPENED',
        browserStatus: browserDisplay as any,
        agentStatus: 'Ready',
        currentStep: 1,
        currentUrl: data.currentUrl || formattedUrl,
        pageTitle: data.title || null,
        isHeadlessFallback: data.isHeadlessFallback,
      });

      setStatusMessage(data.message);

      // Record the single genuine navigation event
      setJourneySteps([
        {
          stepNumber: 1,
          action: 'navigate',
          description: `Browser launched and target page opened: "${data.title || formattedUrl}"`,
          url: data.currentUrl || formattedUrl,
          status: 'success',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      console.error('[Browser Launch Error]', err);
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
              disabled={isLaunching}
            />

            {/* Testing Goal Input */}
            <TestingGoal
              goal={testingGoal}
              onChange={setTestingGoal}
              disabled={isLaunching}
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

        {/* Middle Dual Panels: Live Journey & Findings */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <JourneyPanel steps={journeySteps} />
          <FindingsPanel findings={findings} />
        </section>

        {/* Browser Evidence Panel */}
        <section>
          <BrowserEvidencePanel evidenceCount={0} />
        </section>

        {/* Audit Report Panel */}
        <section>
          <AuditReportPanel report={auditReport} />
        </section>
      </main>

      {/* Developer / Technical Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            PRAGYAAN 2.0 • Clash of Devs Hackathon @ KMIT
          </span>
          <span className="text-zinc-500">
            P8: Autonomous Agentic Black-Box UI/UX &amp; Accessibility Testing (Phase 2: Playwright Runtime)
          </span>
        </div>
      </footer>
    </div>
  );
}

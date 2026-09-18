/**
 * HIVEAI / FLOWSENTRY
 * Hackathon PoC for PRAGYAAN 2.0 / Clash of Devs at KMIT
 * Problem Statement: P8 — Autonomous Agentic Black-Box UI/UX & Accessibility Testing Framework
 * 
 * Phase 4: Agent Reasoning + Autonomous Action
 * Autonomous loop: OBSERVE -> REASON (Gemini) -> ACT (Playwright) -> RE-OBSERVE
 */

import React, { useState, useRef } from 'react';
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

  // Active loop abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Agent & Browser Status
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({
    state: 'READY',
    browserStatus: 'Not launched',
    agentStatus: 'Idle',
    currentStep: null,
    currentUrl: null,
    pageTitle: null,
    activity: null,
    isRunning: false,
  });

  // Real Page Observation State
  const [pageObservation, setPageObservation] = useState<PageObservation | null>(null);

  // Genuine journey trace (genuine events only)
  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([]);

  // Phase 4 keeps empty findings (Phase 5 will do full audit analysis)
  const [findings] = useState<FindingsSummary>({
    accessibilityCount: 0,
    uxFrictionCount: 0,
    potentialIssuesCount: 0,
  });

  // Phase 4 keeps empty audit report
  const [auditReport] = useState<AuditReport>({
    goal: null,
    status: null,
    totalSteps: null,
    accessibilityFindings: null,
    uxFrictionFindings: null,
  });

  const handleStopAgent = async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      await fetch('/api/agent/stop', { method: 'POST' });
      setAgentStatus((prev) => ({
        ...prev,
        state: 'STOPPED',
        agentStatus: 'Stopped',
        isRunning: false,
        activity: {
          phase: 'COMPLETE',
          headline: 'Agent execution stopped by user',
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
      setIsLaunching(false);
      setStatusMessage('Agent stopped by user.');
    } catch (err: any) {
      console.error('[Stop Agent Error]', err);
    }
  };

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
    setJourneySteps([]);

    setAgentStatus({
      state: 'STARTING BROWSER',
      browserStatus: 'Launching...',
      agentStatus: 'Starting...',
      currentStep: null,
      currentUrl: formattedUrl,
      pageTitle: null,
      isRunning: true,
      activity: {
        phase: 'NAVIGATE',
        headline: `Launching Chromium and navigating to ${formattedUrl}`,
        timestamp: new Date().toLocaleTimeString(),
      },
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          targetUrl: formattedUrl,
          goal: testingGoal.trim() || undefined,
          maxSteps: 15,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errText = 'Failed to start agent run.';
        try {
          const errJson = await response.json();
          errText = errJson.message || errJson.error || errText;
        } catch {
          // ignore json parse error
        }
        throw new Error(errText);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser response.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const trimmedBlock = block.trim();
          if (!trimmedBlock.startsWith('data:')) continue;
          const jsonStr = trimmedBlock.replace(/^data:\s*/, '').trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            handleAgentEvent(event, formattedUrl);
          } catch (jsonErr) {
            console.warn('[SSE Parse Warning]', jsonErr, jsonStr);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[Agent Run Aborted]');
        return;
      }
      console.error('[Agent Autonomous Run Error]', err);
      const displayError = err?.message || 'Agent loop encountered an error.';
      setErrorMessage(displayError);

      setAgentStatus((prev) => ({
        ...prev,
        state: 'AGENT FAILED',
        agentStatus: 'Error',
        isRunning: false,
        errorMessage: displayError,
        activity: {
          phase: 'ERROR',
          headline: displayError,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setIsLaunching(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Dispatches real-time SSE stream events to the dashboard state
   */
  const handleAgentEvent = (event: any, defaultUrl: string) => {
    const timestamp = event.timestamp || new Date().toLocaleTimeString();

    switch (event.type) {
      case 'START':
        setAgentStatus((prev) => ({
          ...prev,
          state: 'STARTING BROWSER',
          browserStatus: 'Launching...',
          agentStatus: 'Starting...',
          currentUrl: event.url,
          isRunning: true,
          activity: {
            phase: 'NAVIGATE',
            headline: `Targeting: ${event.url}`,
            detail: event.goal ? `Goal: "${event.goal}"` : 'Autonomous general exploratory audit',
            timestamp,
          },
        }));
        break;

      case 'NAVIGATE': {
        const browserMode = event.isHeadlessFallback
          ? 'Active (Chromium - Container)'
          : 'Active (Chromium - Visible Window)';

        setAgentStatus((prev) => ({
          ...prev,
          state: 'TARGET PAGE OPENED',
          browserStatus: browserMode,
          agentStatus: 'Ready',
          currentStep: 1,
          currentUrl: event.url,
          pageTitle: event.title,
          isHeadlessFallback: event.isHeadlessFallback,
          activity: {
            phase: 'NAVIGATE',
            headline: `Target page loaded: "${event.title || event.url}"`,
            timestamp,
          },
        }));

        setJourneySteps([
          {
            stepNumber: 1,
            action: 'navigate',
            description: `Navigated to target URL: ${event.url}`,
            url: event.url,
            status: 'success',
            timestamp,
          },
        ]);
        break;
      }

      case 'OBSERVE': {
        const obs: PageObservation = event.observation;
        setPageObservation(obs);

        setAgentStatus((prev) => ({
          ...prev,
          state: 'OBSERVING PAGE',
          agentStatus: 'Observing...',
          currentStep: event.stepNumber,
          currentUrl: obs.url || prev.currentUrl,
          pageTitle: obs.title || prev.pageTitle,
          activity: {
            phase: 'OBSERVE',
            headline: `Observed ${obs.stats.totalInteractiveCount} interactive controls (${obs.stats.buttonCount} buttons, ${obs.stats.linkCount} links, ${obs.stats.inputCount} inputs)`,
            timestamp,
          },
        }));

        setJourneySteps((prev) => {
          const exists = prev.some((s) => s.stepNumber === event.stepNumber && s.action === 'observe');
          if (exists) return prev;
          return [
            ...prev,
            {
              stepNumber: event.stepNumber,
              action: 'observe',
              description: `Observed page state: ${obs.stats.totalInteractiveCount} interactive elements detected, screenshot captured.`,
              url: obs.url,
              status: 'success',
              timestamp,
            },
          ];
        });
        break;
      }

      case 'REASON': {
        const act = event.action;
        const targetDesc = act.target ? ` "${act.target}"` : '';
        const valueDesc = act.value ? ` with "${act.value}"` : '';
        const headline = `Gemini decided: ${act.type.toUpperCase()}${targetDesc}${valueDesc}`;

        setAgentStatus((prev) => ({
          ...prev,
          state: 'REASONING',
          agentStatus: 'Reasoning...',
          currentStep: event.stepNumber,
          activity: {
            phase: 'REASON',
            headline,
            explanation: act.explanation,
            timestamp,
          },
        }));

        setJourneySteps((prev) => [
          ...prev,
          {
            stepNumber: event.stepNumber,
            action: 'reason',
            actionType: act.type,
            target: act.target,
            value: act.value,
            description: `Selected next action: ${act.type.toUpperCase()}${targetDesc}${valueDesc}`,
            explanation: act.explanation,
            status: 'running',
            timestamp,
          },
        ]);
        break;
      }

      case 'ACTION': {
        const act = event.action;
        const res = event.result;
        const stateName = res.success ? 'ACTION COMPLETED' : 'ACTION FAILED';
        const headline = `${act.type.toUpperCase()} execution ${res.success ? 'succeeded' : 'failed'}: ${res.message}`;

        setAgentStatus((prev) => ({
          ...prev,
          state: stateName,
          agentStatus: 'Executing...',
          currentStep: event.stepNumber,
          activity: {
            phase: 'ACT',
            headline,
            explanation: act.explanation,
            timestamp,
          },
        }));

        // Update journey step status
        setJourneySteps((prev) => {
          const updated = [...prev];
          // Find the running step
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].stepNumber === event.stepNumber && updated[i].action === 'reason') {
              updated[i] = {
                ...updated[i],
                action: act.type === 'finish' ? 'finish' : 'action',
                description: `${act.type.toUpperCase()} executed: ${res.message}`,
                status: res.success ? 'success' : 'failed',
                timestamp,
              };
              break;
            }
          }
          return updated;
        });
        break;
      }

      case 'COMPLETE': {
        const loopRes = event.result || event;
        const isGoalMet = loopRes.reason === 'goal_met';
        const finalState = isGoalMet ? 'GOAL COMPLETED' : loopRes.reason === 'stopped' ? 'STOPPED' : 'READY';

        setAgentStatus((prev) => ({
          ...prev,
          state: finalState,
          agentStatus: isGoalMet ? 'Completed' : 'Ready',
          isRunning: false,
          activity: {
            phase: 'COMPLETE',
            headline: `Autonomous agent completed. Reason: ${loopRes.reason} (${loopRes.totalSteps || 0} steps executed)`,
            timestamp,
          },
        }));

        setStatusMessage(`Agent loop finished: ${loopRes.reason} with ${loopRes.totalSteps || 0} steps executed.`);
        break;
      }

      case 'ERROR': {
        setAgentStatus((prev) => ({
          ...prev,
          state: 'AGENT FAILED',
          agentStatus: 'Error',
          isRunning: false,
          errorMessage: event.error,
          activity: {
            phase: 'ERROR',
            headline: `Error: ${event.error}`,
            timestamp,
          },
        }));
        setErrorMessage(event.error);
        break;
      }

      default:
        break;
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
            description: `Manual page inspection: ${data.observation?.stats.totalInteractiveCount} interactive elements, ${data.observation?.visibleText.length} text blocks observed`,
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
              onStopAgent={handleStopAgent}
              isLaunching={isLaunching}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
              onDismissMessage={handleDismissMessages}
            />
          </div>
        </section>

        {/* Agent Status Panel */}
        <section>
          <AgentStatusPanel
            status={agentStatus}
            onStopAgent={handleStopAgent}
          />
        </section>

        {/* Phase 3/4: Page Observation Panel */}
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

        {/* Audit Report Panel (Empty state preserved for Phase 4) */}
        <section>
          <AuditReportPanel report={auditReport} />
        </section>
      </main>

      {/* Developer / Technical Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            HIVEAI • FLOWSENTRY • PRAGYAAN 2.0 / Clash of Devs Hackathon @ KMIT
          </span>
          <span className="text-zinc-500">
            P8: Autonomous Agentic Black-Box UI/UX &amp; Accessibility Testing (Phase 4: Agent Reasoning + Autonomous Action)
          </span>
        </div>
      </footer>
    </div>
  );
}

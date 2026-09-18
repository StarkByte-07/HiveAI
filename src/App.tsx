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
  JourneyActionType,
  PageObservation,
  ObservationResponse,
  AccessibilityAuditResult,
} from './types/index.ts';

export default function App() {
  // Controlled input states
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [testingGoal, setTestingGoal] = useState<string>('');
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [isObserving, setIsObserving] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
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

  // Phase 5 Accessibility findings and metrics
  const [findings, setFindings] = useState<FindingsSummary>({
    accessibilityCount: 0,
    uxFrictionCount: 0,
    potentialIssuesCount: 0,
  });
  const [accessibilityAudit, setAccessibilityAudit] = useState<AccessibilityAuditResult | null>(null);

  // Phase 4 Audit report with intent & extracted results support
  const [auditReport, setAuditReport] = useState<AuditReport>({
    goal: null,
    status: null,
    totalSteps: null,
    accessibilityFindings: null,
    uxFrictionFindings: null,
    intentType: null,
    extractedResults: null,
    summary: null,
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
      setAuditReport((prev) => ({
        ...prev,
        status: 'Failed',
        summary: 'Agent run was stopped by user.',
      }));
      setStatusMessage('Agent execution stopped by user.');
      setIsLaunching(false);
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

    setAuditReport({
      goal: testingGoal.trim() || 'General page exploration',
      status: 'In progress',
      totalSteps: 0,
      accessibilityFindings: 0,
      uxFrictionFindings: 0,
      intentType: null,
      extractedResults: null,
      summary: null,
    });

    setAgentStatus({
      state: 'STARTING BROWSER',
      browserStatus: 'Launching...',
      agentStatus: 'Starting...',
      currentStep: null,
      currentUrl: formattedUrl,
      pageTitle: null,
      isRunning: true,
      intentType: undefined,
      extractedResults: undefined,
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
    if (!event || typeof event !== 'object') return;
    const timestamp = event.timestamp || new Date().toLocaleTimeString();

    switch (event.type) {
      case 'START': {
        const targetAddress = event.url || defaultUrl;
        setAgentStatus((prev) => ({
          ...prev,
          state: 'STARTING BROWSER',
          browserStatus: 'Launching...',
          agentStatus: 'Starting...',
          currentUrl: targetAddress,
          isRunning: true,
          activity: {
            phase: 'NAVIGATE',
            headline: `Targeting: ${targetAddress}`,
            detail: event.goal ? `Goal: "${event.goal}"` : 'Autonomous general exploratory audit',
            timestamp,
          },
        }));
        break;
      }

      case 'NAVIGATE': {
        const targetAddress = event.url || defaultUrl;
        const browserMode = event.isHeadlessFallback
          ? 'Active (Chromium - Container)'
          : 'Active (Chromium - Visible Window)';

        setAgentStatus((prev) => ({
          ...prev,
          state: 'TARGET PAGE OPENED',
          browserStatus: browserMode,
          agentStatus: 'Ready',
          currentStep: event.stepNumber || 1,
          currentUrl: targetAddress,
          pageTitle: event.title || targetAddress,
          isHeadlessFallback: event.isHeadlessFallback,
          activity: {
            phase: 'NAVIGATE',
            headline: `Target page loaded: "${event.title || targetAddress}"`,
            timestamp,
          },
        }));

        setJourneySteps([
          {
            stepNumber: event.stepNumber || 1,
            action: 'navigate',
            description: event.description || `Navigated to target URL: ${targetAddress}`,
            url: targetAddress,
            status: 'success',
            timestamp,
          },
        ]);
        break;
      }

      case 'OBSERVE': {
        const obs: PageObservation | undefined = event.observation;
        if (obs) {
          setPageObservation(obs);
        }

        const totalInteractive = obs?.stats?.totalInteractiveCount ?? obs?.interactiveElements?.length ?? 0;
        const buttonCount = obs?.stats?.buttonCount ?? 0;
        const linkCount = obs?.stats?.linkCount ?? 0;
        const inputCount = obs?.stats?.inputCount ?? 0;

        const headline = obs
          ? `Observed ${totalInteractive} interactive controls (${buttonCount} buttons, ${linkCount} links, ${inputCount} inputs)`
          : (event.description || 'Inspecting active page structure and interactive elements...');

        const currentUrl = obs?.url || event.url;

        setAgentStatus((prev) => ({
          ...prev,
          state: 'OBSERVING PAGE',
          agentStatus: 'Observing...',
          currentStep: event.stepNumber ?? prev.currentStep,
          currentUrl: currentUrl || prev.currentUrl,
          pageTitle: obs?.title || prev.pageTitle,
          activity: {
            phase: 'OBSERVE',
            headline,
            timestamp,
          },
        }));

        if (obs) {
          setJourneySteps((prev) => {
            const exists = prev.some((s) => s.stepNumber === event.stepNumber && s.action === 'observe');
            if (exists) return prev;
            return [
              ...prev,
              {
                stepNumber: event.stepNumber,
                action: 'observe',
                description: event.description || `Observed page state: ${totalInteractive} interactive elements detected, screenshot captured.`,
                url: obs.url || currentUrl || '',
                status: 'success',
                timestamp,
              },
            ];
          });
        }
        break;
      }

      case 'REASON': {
        const act = event.action;
        const isPending = event.status === 'running' || !act;

        if (isPending) {
          setAgentStatus((prev) => ({
            ...prev,
            state: 'REASONING',
            agentStatus: 'Reasoning...',
            currentStep: event.stepNumber ?? prev.currentStep,
            activity: {
              phase: 'REASON',
              headline: event.description || 'Gemini is evaluating page state and testing goal...',
              timestamp,
            },
          }));

          setJourneySteps((prev) => {
            const exists = prev.some((s) => s.stepNumber === event.stepNumber && s.action === 'reason');
            if (exists) return prev;
            return [
              ...prev,
              {
                stepNumber: event.stepNumber,
                action: 'reason',
                description: event.description || 'Gemini evaluating page observation...',
                status: 'running',
                timestamp,
              },
            ];
          });
        } else {
          // Reasoned decision arrived
          const rawType = act.action || act.type || event.actionType || 'ACTION';
          const actionName = String(rawType).toLowerCase();
          const targetDesc = act.target ? ` "${act.target}"` : '';
          const valueDesc = act.value ? ` with "${act.value}"` : '';
          const headline = `Gemini decided: ${actionName.toUpperCase()}${targetDesc}${valueDesc}`;
          const currentIntent = event.intentType || act.intentType;
          const currentResults = event.extractedResults || act.extractedResults;

          setAgentStatus((prev) => ({
            ...prev,
            state: 'REASONING',
            agentStatus: 'Reasoning Complete',
            currentStep: event.stepNumber ?? prev.currentStep,
            intentType: currentIntent || prev.intentType,
            extractedResults: currentResults || prev.extractedResults,
            activity: {
              phase: 'REASON',
              headline,
              explanation: act.explanation || event.explanation,
              timestamp,
              intentType: currentIntent || prev.intentType,
              extractedResults: currentResults || prev.extractedResults,
            },
          }));

          setJourneySteps((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex((s) => s.stepNumber === event.stepNumber && s.action === 'reason');
            const stepEntry: JourneyStep = {
              stepNumber: event.stepNumber,
              action: 'reason',
              actionType: actionName,
              target: act.target,
              value: act.value,
              description: `Selected next action: ${actionName.toUpperCase()}${targetDesc}${valueDesc}`,
              explanation: act.explanation || event.explanation,
              status: 'running',
              timestamp,
              intentType: currentIntent,
              extractedResults: currentResults,
            };
            if (idx >= 0) {
              updated[idx] = stepEntry;
            } else {
              updated.push(stepEntry);
            }
            return updated;
          });
        }
        break;
      }

      case 'ACTION': {
        const act = event.action;
        const rawType = act?.action || act?.type || event.actionType || 'ACTION';
        const actionName = String(rawType).toLowerCase();
        const targetDesc = act?.target ? ` "${act.target}"` : '';
        const valueDesc = act?.value ? ` with "${act.value}"` : '';
        const isSuccess = event.status === 'success' || event.result?.success === true || (event.status !== 'failed' && event.result?.success !== false);
        const detailMessage = event.description || event.result?.message || (isSuccess ? 'Action completed' : 'Action failed');
        const stateName = isSuccess ? 'ACTION COMPLETED' : 'ACTION FAILED';
        const headline = `${actionName.toUpperCase()} execution ${isSuccess ? 'succeeded' : 'failed'}: ${detailMessage}`;
        const currentIntent = event.intentType || act?.intentType;
        const currentResults = event.extractedResults || act?.extractedResults;

        setAgentStatus((prev) => ({
          ...prev,
          state: stateName,
          agentStatus: isSuccess ? 'Action Completed' : 'Action Failed',
          currentStep: event.stepNumber ?? prev.currentStep,
          currentUrl: event.url || prev.currentUrl,
          intentType: currentIntent || prev.intentType,
          extractedResults: currentResults || prev.extractedResults,
          activity: {
            phase: 'ACT',
            headline,
            explanation: act?.explanation || event.explanation,
            timestamp,
            intentType: currentIntent || prev.intentType,
            extractedResults: currentResults || prev.extractedResults,
          },
        }));

        const resolvedActionType: JourneyActionType = actionName === 'finish' ? 'finish' : 'action';

        setJourneySteps((prev) => {
          const updated = [...prev];
          let found = false;
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].stepNumber === event.stepNumber && updated[i].action === 'reason') {
              updated[i] = {
                ...updated[i],
                action: resolvedActionType,
                actionType: actionName,
                target: act?.target || updated[i].target,
                value: act?.value || updated[i].value,
                description: `${actionName.toUpperCase()}${targetDesc}${valueDesc}: ${detailMessage}`,
                status: isSuccess ? 'success' : 'failed',
                timestamp,
                url: event.url || updated[i].url,
                intentType: currentIntent || updated[i].intentType,
                extractedResults: currentResults || updated[i].extractedResults,
              };
              found = true;
              break;
            }
          }
          if (!found) {
            updated.push({
              stepNumber: event.stepNumber,
              action: resolvedActionType,
              actionType: actionName,
              target: act?.target,
              value: act?.value,
              description: `${actionName.toUpperCase()}${targetDesc}${valueDesc}: ${detailMessage}`,
              status: isSuccess ? 'success' : 'failed',
              timestamp,
              url: event.url,
              intentType: currentIntent,
              extractedResults: currentResults,
            });
          }
          return updated;
        });
        break;
      }

      case 'FINISH':
      case 'COMPLETE': {
        const loopRes = event.result || event;
        const rawStatus = String(loopRes.status || loopRes.reason || 'completed').toLowerCase();
        const isGoalMet = rawStatus === 'completed' || rawStatus === 'goal_met';
        const isStopped = rawStatus === 'stopped';
        const finalState = isGoalMet ? 'GOAL COMPLETED' : isStopped ? 'STOPPED' : (rawStatus === 'max_steps_reached' ? 'AGENT FAILED' : 'READY');

        const finalIntent = loopRes.intentType || event.intentType || event.action?.intentType;
        const finalResults = loopRes.extractedResults || event.extractedResults || event.action?.extractedResults;
        const explanationText = event.explanation || event.action?.explanation || loopRes.message || event.description;
        const audit: AccessibilityAuditResult | undefined = loopRes.accessibilityAudit || event.accessibilityAudit;

        if (loopRes.finalObservation) {
          setPageObservation(loopRes.finalObservation);
        }

        if (audit) {
          setAccessibilityAudit(audit);
          setFindings({
            accessibilityCount: audit.totalViolations || 0,
            uxFrictionCount: 0,
            potentialIssuesCount: audit.summary?.minor || 0,
          });
        }

        setAgentStatus((prev) => ({
          ...prev,
          state: finalState,
          agentStatus: isGoalMet ? 'Completed' : isStopped ? 'Stopped' : (rawStatus === 'max_steps_reached' ? 'Max Steps Reached' : 'Failed'),
          isRunning: false,
          currentUrl: loopRes.finalObservation?.url || event.url || prev.currentUrl,
          intentType: finalIntent || prev.intentType,
          extractedResults: finalResults || prev.extractedResults,
          activity: {
            phase: 'COMPLETE',
            headline: `Autonomous agent finished: ${loopRes.reason || loopRes.status || 'Complete'} (${loopRes.totalSteps || event.stepNumber || 0} steps)`,
            detail: loopRes.message || event.description,
            explanation: explanationText,
            timestamp,
            intentType: finalIntent || prev.intentType,
            extractedResults: finalResults || prev.extractedResults,
          },
        }));

        setAuditReport((prev) => ({
          goal: testingGoal.trim() || prev.goal || 'General page exploration',
          status: isGoalMet ? 'Completed' : 'Failed',
          totalSteps: loopRes.totalSteps ?? event.stepNumber ?? prev.totalSteps ?? 0,
          accessibilityFindings: audit ? (audit.totalViolations ?? 0) : prev.accessibilityFindings,
          uxFrictionFindings: 0,
          generatedAt: new Date().toLocaleTimeString(),
          intentType: finalIntent || prev.intentType,
          extractedResults: finalResults || prev.extractedResults,
          accessibilityAudit: audit || prev.accessibilityAudit,
          summary: explanationText || loopRes.message || event.description,
        }));

        setStatusMessage(loopRes.message || event.description || `Agent loop finished: ${rawStatus} with ${loopRes.totalSteps || 0} steps.`);
        break;
      }

      case 'ERROR': {
        const errText = event.error || event.description || 'Unknown agent error occurred.';
        setAgentStatus((prev) => ({
          ...prev,
          state: 'AGENT FAILED',
          agentStatus: 'Error',
          isRunning: false,
          errorMessage: errText,
          activity: {
            phase: 'ERROR',
            headline: `Error: ${errText}`,
            timestamp,
          },
        }));
        setAuditReport((prev) => ({
          ...prev,
          status: 'Failed',
          summary: `Agent execution encountered an error: ${errText}`,
        }));
        setErrorMessage(errText);
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

  /**
   * On-demand manual accessibility audit handler
   */
  const handleRunAccessibilityAudit = async () => {
    if (isAuditing) return;
    setIsAuditing(true);
    setErrorMessage(null);
    setStatusMessage('Running autonomous black-box accessibility audit with axe-core & DOM checks...');

    try {
      const response = await fetch('/api/agent/audit/accessibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.audit) {
        throw new Error(data.message || data.error || 'Failed to complete accessibility audit.');
      }

      const audit: AccessibilityAuditResult = data.audit;
      setAccessibilityAudit(audit);
      setFindings({
        accessibilityCount: audit.totalViolations || 0,
        uxFrictionCount: 0,
        potentialIssuesCount: audit.summary?.minor || 0,
      });
      setAuditReport((prev) => ({
        ...prev,
        accessibilityFindings: audit.totalViolations || 0,
        accessibilityAudit: audit,
      }));
      setStatusMessage(`Accessibility audit completed: ${audit.totalViolations} violations detected.`);
    } catch (err: any) {
      console.error('[Accessibility Audit Error]', err);
      setErrorMessage(err?.message || 'Failed to execute accessibility audit.');
    } finally {
      setIsAuditing(false);
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
          <FindingsPanel
            findings={findings}
            auditResult={accessibilityAudit}
            onRunAudit={handleRunAccessibilityAudit}
            isAuditing={isAuditing}
          />
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

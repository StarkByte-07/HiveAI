import { Router, Request, Response } from 'express';
import { browserManager } from '../browser/browserManager.ts';
import { observationEngine } from '../observation/observationEngine.ts';
import { agentLoop } from '../agent/agentLoop.ts';
import { agentReasoner } from '../agent/agentReasoner.ts';
import { accessibilityAuditor } from '../audit/accessibilityAuditor.ts';

export const agentRouter = Router();

/**
 * POST /api/agent/run
 * Phase 4: Full Autonomous Agent Loop
 * Navigates, observes, reasons with Gemini, and executes real Playwright actions.
 * Streams step-by-step progress via Server-Sent Events (SSE).
 */
agentRouter.post('/run', async (req: Request, res: Response): Promise<void> => {
  const { targetUrl, goal, maxSteps } = req.body || {};

  // 1. Validate targetUrl
  if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.trim().length === 0) {
    res.status(400).json({
      success: false,
      status: 'ERROR',
      message: 'A valid targetUrl is required.',
      error: 'Missing or empty targetUrl parameter.',
    });
    return;
  }

  const cleanUrl = targetUrl.trim();
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        message: 'Target URL must start with http:// or https://',
        error: `Unsupported protocol: ${parsed.protocol}`,
      });
      return;
    }
  } catch (urlErr) {
    res.status(400).json({
      success: false,
      status: 'ERROR',
      message: 'Invalid target URL format.',
      error: (urlErr as Error).message,
    });
    return;
  }

  // Check if agent is already running
  if (agentLoop.isLoopRunning()) {
    res.status(409).json({
      success: false,
      status: 'BUSY',
      message: 'An agent execution is already active. Please wait or stop it first.',
    });
    return;
  }

  // Determine if streaming is requested (default is SSE streaming)
  const isStreaming = req.headers.accept?.includes('text/event-stream') || req.query.stream === 'true' || true;

  if (isStreaming) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Abort loop if client abruptly disconnects before response finishes
    res.on('close', () => {
      if (!res.writableEnded && agentLoop.isLoopRunning()) {
        console.log('[AgentRun] Client aborted connection, requesting agent loop abort...');
        agentLoop.abort();
      }
    });

    try {
      const result = await agentLoop.run(cleanUrl, goal || '', {
        maxSteps: typeof maxSteps === 'number' ? maxSteps : 15,
        onEvent: (event) => {
          try {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          } catch (writeErr) {
            console.error('[AgentRun] Error streaming event:', writeErr);
          }
        },
      });

      // Send terminal result wrapper
      res.write(`data: ${JSON.stringify({ type: 'COMPLETE', result })}\n\n`);
      res.end();
    } catch (err: any) {
      console.error('[AgentRun Stream Error]', err);
      res.write(`data: ${JSON.stringify({ type: 'ERROR', error: err?.message || 'Agent error' })}\n\n`);
      res.end();
    }
  } else {
    try {
      const result = await agentLoop.run(cleanUrl, goal || '', {
        maxSteps: typeof maxSteps === 'number' ? maxSteps : 15,
      });
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[AgentRun Error]', err);
      res.status(500).json({
        success: false,
        status: 'FAILED',
        message: err?.message || 'Agent loop failed',
        error: err?.message,
      });
    }
  }
});

/**
 * POST /api/agent/stop
 * Requests stopping any currently active agent execution.
 */
agentRouter.post('/stop', (_req: Request, res: Response): void => {
  if (agentLoop.isLoopRunning()) {
    agentLoop.abort();
    res.status(200).json({ success: true, message: 'Agent stop requested.' });
  } else {
    res.status(200).json({ success: true, message: 'Agent was not running.' });
  }
});

/**
 * POST /api/agent/start
 * Launches Playwright Chromium in visible (headed) mode, navigates to targetUrl,
 * and automatically performs a real page observation.
 */
agentRouter.post('/start', async (req: Request, res: Response): Promise<void> => {
  const { targetUrl } = req.body || {};

  // 1. Validate targetUrl existence
  if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.trim().length === 0) {
    res.status(400).json({
      success: false,
      status: 'ERROR',
      message: 'A valid targetUrl is required.',
      error: 'Missing or empty targetUrl parameter.',
    });
    return;
  }

  const cleanUrl = targetUrl.trim();

  // 2. Validate valid HTTP / HTTPS protocol
  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      res.status(400).json({
        success: false,
        status: 'ERROR',
        message: 'Invalid URL protocol. Target URL must start with http:// or https://',
        error: `Unsupported protocol: ${parsed.protocol}`,
      });
      return;
    }
  } catch (urlErr) {
    res.status(400).json({
      success: false,
      status: 'ERROR',
      message: 'Invalid target URL format. Please provide a well-formed web address (e.g., https://example.com).',
      error: (urlErr as Error).message,
    });
    return;
  }

  // 3. Launch browser and navigate
  try {
    const result = await browserManager.launchAndNavigate(cleanUrl);

    // 4. Automatic Phase 3 Page Observation
    let observation = null;
    const page = browserManager.getPage();
    if (page) {
      try {
        observation = await observationEngine.observePage(page);
      } catch (obsErr: any) {
        console.warn('[Observation warning during start]', obsErr?.message);
      }
    }

    const finalTitle = (observation && observation.title) ? observation.title : result.title;

    res.status(200).json({
      success: true,
      status: 'TARGET PAGE OPENED',
      currentUrl: result.url,
      title: finalTitle,
      observation,
      message: result.isHeadlessFallback
        ? 'Chromium launched (running in container headless mode) and page observed.'
        : 'Chromium browser launched in visible window and page observed successfully.',
      isHeadlessFallback: result.isHeadlessFallback,
    });
  } catch (err: any) {
    console.error('[Agent Start Error]', err);
    res.status(500).json({
      success: false,
      status: 'ERROR',
      message: err?.message || 'Failed to launch browser or navigate to target URL.',
      error: err?.message || 'Unknown browser error',
    });
  }
});

/**
 * POST /api/agent/observe
 * Inspects the currently active Playwright page without re-navigating.
 */
agentRouter.post('/observe', async (_req: Request, res: Response): Promise<void> => {
  const page = browserManager.getPage();
  if (!page || page.isClosed()) {
    res.status(400).json({
      success: false,
      message: 'No active browser session found. Please run the agent to open a target page first.',
      error: 'Browser not started or page closed.',
    });
    return;
  }

  try {
    const observation = await observationEngine.observePage(page);
    res.status(200).json({
      success: true,
      observation,
      message: `Observed ${observation.interactiveElements.length} interactive elements and ${observation.visibleText.length} text blocks.`,
    });
  } catch (err: any) {
    console.error('[Observe Error]', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Failed to observe active browser page.',
      error: err?.message || 'Observation failed',
    });
  }
});

/**
 * POST /api/agent/audit/accessibility
 * Phase 5: Autonomous Black-Box Accessibility Audit
 * Audits the active Playwright page with axe-core and custom heuristics.
 */
agentRouter.post('/audit/accessibility', async (_req: Request, res: Response): Promise<void> => {
  const page = browserManager.getPage();
  if (!page || page.isClosed()) {
    res.status(400).json({
      success: false,
      message: 'No active browser session found. Please run the agent to open a target page first.',
      error: 'Browser not started or page closed.',
    });
    return;
  }

  try {
    const observation = await observationEngine.observePage(page);
    const auditResult = await accessibilityAuditor.auditPage(page, observation);
    res.status(200).json({
      success: true,
      audit: auditResult,
      message: `Audit completed: ${auditResult.totalViolations} violations detected across WCAG and black-box DOM rules.`,
    });
  } catch (err: any) {
    console.error('[Accessibility Audit Error]', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'Accessibility audit failed.',
      error: err?.message,
    });
  }
});

/**
 * GET /api/agent/screenshot
 * Streams the latest real screenshot captured from the active browser page.
 */
agentRouter.get('/screenshot', (_req: Request, res: Response): void => {
  const buffer = observationEngine.getLatestScreenshot();
  if (!buffer) {
    res.status(404).send('No screenshot available yet.');
    return;
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(buffer);
});

/**
 * GET /api/agent/status
 * Returns current status of browser manager and active page.
 */
agentRouter.get('/status', (_req: Request, res: Response): void => {
  const status = browserManager.getStatus();
  const latestObs = observationEngine.getLatestObservation();
  const isAgentRunning = agentLoop.isLoopRunning();

  res.status(200).json({
    success: true,
    status: isAgentRunning
      ? 'EXECUTING ACTION'
      : status.isPageActive
      ? 'TARGET PAGE OPENED'
      : status.isLaunched
      ? 'BROWSER LAUNCHED'
      : 'READY',
    currentUrl: status.currentUrl,
    title: status.currentTitle,
    browserActive: status.isLaunched,
    isHeadlessFallback: status.isHeadlessFallback,
    hasObservation: latestObs !== null,
    isAgentRunning,
  });
});

/**
 * GET /api/agent/model-info
 * Returns the current Gemini model, SDK version, and thinking configuration.
 */
agentRouter.get('/model-info', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    ...agentReasoner.getActiveModelInfo(),
  });
});

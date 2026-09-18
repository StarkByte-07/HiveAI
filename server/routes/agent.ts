import { Router, Request, Response } from 'express';
import { browserManager } from '../browser/browserManager.ts';
import { observationEngine } from '../observation/observationEngine.ts';

export const agentRouter = Router();

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

  res.status(200).json({
    success: true,
    status: status.isPageActive ? 'TARGET PAGE OPENED' : status.isLaunched ? 'BROWSER LAUNCHED' : 'READY',
    currentUrl: status.currentUrl,
    title: status.currentTitle,
    browserActive: status.isLaunched,
    isHeadlessFallback: status.isHeadlessFallback,
    hasObservation: latestObs !== null,
  });
});

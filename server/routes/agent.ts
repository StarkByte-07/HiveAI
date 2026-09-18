import { Router, Request, Response } from 'express';
import { browserManager } from '../browser/browserManager.ts';

export const agentRouter = Router();

/**
 * POST /api/agent/start
 * Launches Playwright Chromium in visible (headed) mode and navigates to targetUrl.
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

    res.status(200).json({
      success: true,
      status: 'TARGET PAGE OPENED',
      currentUrl: result.url,
      title: result.title,
      message: result.isHeadlessFallback
        ? 'Chromium launched (running in container headless mode due to lack of local display) and navigated to target page.'
        : 'Chromium browser launched in visible window and navigated to target page successfully.',
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
 * GET /api/agent/status
 * Returns current status of browser manager and active page.
 */
agentRouter.get('/status', (_req: Request, res: Response): void => {
  const status = browserManager.getStatus();
  res.status(200).json({
    success: true,
    status: status.isPageActive ? 'TARGET PAGE OPENED' : status.isLaunched ? 'BROWSER LAUNCHED' : 'READY',
    currentUrl: status.currentUrl,
    title: status.currentTitle,
    browserActive: status.isLaunched,
    isHeadlessFallback: status.isHeadlessFallback,
  });
});

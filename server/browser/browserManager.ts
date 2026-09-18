import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface BrowserNavigationResult {
  success: boolean;
  url: string;
  title: string;
  isHeadlessFallback?: boolean;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private currentUrl: string | null = null;
  private currentTitle: string | null = null;
  private isHeadlessFallback: boolean = false;

  /**
   * Launches Chromium and navigates to the target URL.
   * Default: headed mode (headless: false) as required for local hackathon demo.
   * If running in a headless Linux container with no X11 display, gracefully falls back
   * to headless mode with a clear flag so the user is informed.
   */
  async launchAndNavigate(targetUrl: string): Promise<BrowserNavigationResult> {
    // If browser is already open, ensure page is available
    if (!this.browser || !this.page || this.page.isClosed()) {
      await this.launchBrowser();
    }

    if (!this.page) {
      throw new Error('Failed to initialize browser page');
    }

    try {
      // Set reasonable default timeouts (30 seconds)
      this.page.setDefaultNavigationTimeout(30000);
      this.page.setDefaultTimeout(30000);

      // Navigate to target URL
      const response = await this.page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      this.currentUrl = this.page.url();
      this.currentTitle = await this.page.title();

      const statusCode = response?.status();
      if (statusCode && statusCode >= 400) {
        this.currentTitle = `${this.currentTitle || 'Error'} (HTTP ${statusCode})`;
      }

      return {
        success: true,
        url: this.currentUrl,
        title: this.currentTitle || 'Untitled Page',
        isHeadlessFallback: this.isHeadlessFallback,
      };
    } catch (err: any) {
      const errorMsg = err?.message || 'Navigation failed';
      throw new Error(`Navigation to "${targetUrl}" failed: ${errorMsg}`);
    }
  }

  private async launchBrowser(): Promise<void> {
    // Close any lingering previous instance
    await this.close();

    const explicitHeadless = process.env.PLAYWRIGHT_HEADLESS === 'true';
    let shouldLaunchHeadless = explicitHeadless;

    // Check if running on Linux without DISPLAY (e.g., server container environment)
    if (!explicitHeadless && process.platform === 'linux' && !process.env.DISPLAY) {
      shouldLaunchHeadless = true;
      this.isHeadlessFallback = true;
    } else {
      shouldLaunchHeadless = false;
      this.isHeadlessFallback = false;
    }

    try {
      this.browser = await chromium.launch({
        headless: shouldLaunchHeadless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    } catch (launchErr: any) {
      // If headed launch failed specifically due to display missing, try headless fallback
      if (!shouldLaunchHeadless && (launchErr?.message?.includes('DISPLAY') || launchErr?.message?.includes('X server'))) {
        console.warn('Headed launch failed due to missing X11 display. Falling back to headless mode...');
        shouldLaunchHeadless = true;
        this.isHeadlessFallback = true;
        this.browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
      } else {
        throw new Error(`Failed to launch Chromium: ${launchErr?.message || 'Unknown error'}`);
      }
    }

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AutonomousUiAuditor/1.0',
    });

    this.page = await this.context.newPage();

    // Listen to browser closure
    this.browser.on('disconnected', () => {
      this.browser = null;
      this.context = null;
      this.page = null;
      this.currentUrl = null;
      this.currentTitle = null;
    });
  }

  getPage(): Page | null {
    return this.page;
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  getStatus() {
    const isLaunched = this.browser !== null && this.browser.isConnected();
    const isPageActive = this.page !== null && !this.page.isClosed();

    return {
      isLaunched,
      isPageActive,
      currentUrl: this.currentUrl,
      currentTitle: this.currentTitle,
      isHeadlessFallback: this.isHeadlessFallback,
    };
  }

  async close(): Promise<void> {
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
      if (this.context) {
        await this.context.close().catch(() => {});
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }
    } catch {
      // Ignore cleanup errors
    } finally {
      this.page = null;
      this.context = null;
      this.browser = null;
      this.currentUrl = null;
      this.currentTitle = null;
    }
  }
}

export const browserManager = new BrowserManager();

import { Page, Locator } from 'playwright';
import type { AgentAction, AgentExecutionResult } from './agentTypes.ts';
import type { PageObservation, InteractiveElement } from '../observation/observationTypes.ts';

export class AgentExecutor {
  /**
   * Executes a validated AgentAction against the active Playwright page.
   * Uses semantic and accessibility-driven element locating.
   */
  async executeAction(
    page: Page,
    action: AgentAction,
    observation: PageObservation
  ): Promise<AgentExecutionResult> {
    if (!page || page.isClosed()) {
      return {
        success: false,
        message: 'Browser page is closed or not available.',
        error: 'Page closed',
      };
    }

    try {
      switch (action.action) {
        case 'click':
          return await this.executeClick(page, action.target!, observation);

        case 'type':
          return await this.executeType(page, action.target!, action.value!, observation);

        case 'scroll':
          return await this.executeScroll(page, action.direction || 'down');

        case 'wait':
          return await this.executeWait(page);

        case 'back':
          return await this.executeBack(page);

        case 'navigate':
          return await this.executeNavigate(page, action.url!);

        case 'finish':
          return {
            success: true,
            message: action.explanation || 'Agent determined testing goal is completed.',
            currentUrl: page.url(),
            currentTitle: await page.title().catch(() => 'Untitled'),
          };

        default:
          return {
            success: false,
            message: `Unknown action type: ${(action as any).action}`,
            error: 'Unsupported action',
          };
      }
    } catch (err: any) {
      console.error(`[AgentExecutor] Action "${action.action}" failed:`, err?.message || err);
      return {
        success: false,
        message: `Action "${action.action}" failed: ${err?.message || 'Execution error'}`,
        error: err?.message || 'Execution failed',
        currentUrl: page.url(),
        currentTitle: await page.title().catch(() => 'Untitled'),
      };
    }
  }

  private async executeClick(
    page: Page,
    target: string,
    observation: PageObservation
  ): Promise<AgentExecutionResult> {
    const locator = await this.findElementLocator(page, target, observation);
    if (!locator) {
      throw new Error(`Could not find interactive element matching target: "${target}"`);
    }

    // Scroll into view if needed
    await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});

    // Click with bounded timeout
    await locator.click({ timeout: 5000 });

    // Brief settling period for navigation or UI animations
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});

    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => 'Untitled');

    return {
      success: true,
      message: `Clicked "${target}" successfully.`,
      currentUrl,
      currentTitle,
    };
  }

  private async executeType(
    page: Page,
    target: string,
    value: string,
    observation: PageObservation
  ): Promise<AgentExecutionResult> {
    const locator = await this.findElementLocator(page, target, observation, true);
    if (!locator) {
      throw new Error(`Could not find input element matching target: "${target}"`);
    }

    await locator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await locator.click({ timeout: 4000 }).catch(() => {});
    
    // Clear and fill the value
    await locator.fill(value, { timeout: 4000 });

    // For search boxes and text inputs, submit with Enter to trigger search/form actions
    await locator.press('Enter').catch(() => {});

    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1200).catch(() => {});

    const currentUrl = page.url();
    const currentTitle = await page.title().catch(() => 'Untitled');

    return {
      success: true,
      message: `Typed "${value}" into "${target}".`,
      currentUrl,
      currentTitle,
    };
  }

  private async executeScroll(page: Page, direction: 'up' | 'down'): Promise<AgentExecutionResult> {
    const scrollAmount = direction === 'up' ? -650 : 650;
    await page.evaluate((amount) => {
      window.scrollBy({ top: amount, left: 0, behavior: 'smooth' });
    }, scrollAmount);

    await page.waitForTimeout(700);

    return {
      success: true,
      message: `Scrolled page ${direction}.`,
      currentUrl: page.url(),
      currentTitle: await page.title().catch(() => 'Untitled'),
    };
  }

  private async executeWait(page: Page): Promise<AgentExecutionResult> {
    await page.waitForTimeout(1500);
    return {
      success: true,
      message: 'Waited 1.5 seconds for dynamic content to settle.',
      currentUrl: page.url(),
      currentTitle: await page.title().catch(() => 'Untitled'),
    };
  }

  private async executeBack(page: Page): Promise<AgentExecutionResult> {
    await page.goBack({ timeout: 8000, waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1000);

    return {
      success: true,
      message: 'Navigated back to previous page in browser history.',
      currentUrl: page.url(),
      currentTitle: await page.title().catch(() => 'Untitled'),
    };
  }

  private async executeNavigate(page: Page, url: string): Promise<AgentExecutionResult> {
    await page.goto(url, { timeout: 25000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    return {
      success: true,
      message: `Navigated to ${url}.`,
      currentUrl: page.url(),
      currentTitle: await page.title().catch(() => 'Untitled'),
    };
  }

  /**
   * Resolves a Playwright Locator for a target string using
   * observed element accessibility roles, names, and DOM fallbacks.
   */
  private async findElementLocator(
    page: Page,
    target: string,
    observation: PageObservation,
    isInputPreference: boolean = false
  ): Promise<Locator | null> {
    const cleanTarget = target.trim();
    const cleanLower = cleanTarget.toLowerCase();

    // 1. Check if target directly matches an observed element
    const matchingElement = this.matchObservedElement(cleanTarget, observation);

    if (matchingElement) {
      // If matching element has an accessible role and name, use Playwright getByRole
      if (matchingElement.role && matchingElement.name) {
        try {
          const roleLocator = page.getByRole(matchingElement.role as any, {
            name: matchingElement.name,
            exact: false,
          }).first();
          if (await roleLocator.count() > 0) {
            return roleLocator;
          }
        } catch {
          // Continue to next heuristic
        }
      }

      // Try getByLabel / getByPlaceholder for inputs
      if (matchingElement.name) {
        try {
          const labelLoc = page.getByLabel(matchingElement.name, { exact: false }).first();
          if (await labelLoc.count() > 0) return labelLoc;

          const placeholderLoc = page.getByPlaceholder(matchingElement.name, { exact: false }).first();
          if (await placeholderLoc.count() > 0) return placeholderLoc;

          const textLoc = page.getByText(matchingElement.name, { exact: false }).first();
          if (await textLoc.count() > 0) return textLoc;
        } catch {
          // Continue
        }
      }
    }

    // 2. Direct semantic targeting with cleanTarget
    if (isInputPreference) {
      try {
        const placeholderLoc = page.getByPlaceholder(cleanTarget, { exact: false }).first();
        if (await placeholderLoc.count() > 0) return placeholderLoc;

        const labelLoc = page.getByLabel(cleanTarget, { exact: false }).first();
        if (await labelLoc.count() > 0) return labelLoc;

        const roleSearch = page.getByRole('searchbox', { name: cleanTarget, exact: false }).first();
        if (await roleSearch.count() > 0) return roleSearch;

        const roleTextbox = page.getByRole('textbox', { name: cleanTarget, exact: false }).first();
        if (await roleTextbox.count() > 0) return roleTextbox;

        // Common search inputs fallback
        const generalInput = page.locator('input[type="search"], input[type="text"], input:not([type="hidden"])').first();
        if (await generalInput.count() > 0) return generalInput;
      } catch {
        // Continue
      }
    }

    // 3. Try standard button / link / element targeting
    try {
      const btnLoc = page.getByRole('button', { name: cleanTarget, exact: false }).first();
      if (await btnLoc.count() > 0) return btnLoc;

      const linkLoc = page.getByRole('link', { name: cleanTarget, exact: false }).first();
      if (await linkLoc.count() > 0) return linkLoc;

      const textLoc = page.getByText(cleanTarget, { exact: false }).first();
      if (await textLoc.count() > 0) return textLoc;
    } catch {
      // Continue
    }

    // 4. CSS-based flexible match fallback
    try {
      const cssLoc = page.locator(
        `button:has-text("${cleanTarget}"), a:has-text("${cleanTarget}"), [aria-label*="${cleanTarget}" i], [placeholder*="${cleanTarget}" i], [title*="${cleanTarget}" i]`
      ).first();
      if (await cssLoc.count() > 0) return cssLoc;
    } catch {
      // Continue
    }

    return null;
  }

  private matchObservedElement(
    target: string,
    observation: PageObservation
  ): InteractiveElement | null {
    const cleanLower = target.toLowerCase();

    // Match by ID directly (e.g. elem_0)
    const byId = observation.interactiveElements.find(
      (el) => el.id.toLowerCase() === cleanLower
    );
    if (byId) return byId;

    // Match by exact name
    const byExactName = observation.interactiveElements.find(
      (el) => el.name && el.name.toLowerCase() === cleanLower
    );
    if (byExactName) return byExactName;

    // Match by exact text
    const byExactText = observation.interactiveElements.find(
      (el) => el.text && el.text.toLowerCase() === cleanLower
    );
    if (byExactText) return byExactText;

    // Match by inclusion
    const byInclusion = observation.interactiveElements.find(
      (el) =>
        (el.name && (el.name.toLowerCase().includes(cleanLower) || cleanLower.includes(el.name.toLowerCase()))) ||
        (el.text && (el.text.toLowerCase().includes(cleanLower) || cleanLower.includes(el.text.toLowerCase())))
    );
    if (byInclusion) return byInclusion;

    return null;
  }
}

export const agentExecutor = new AgentExecutor();

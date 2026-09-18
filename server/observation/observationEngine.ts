import { Page } from 'playwright';
import { PageObservation, InteractiveElement, ObservationStats } from './observationTypes.ts';

interface DomObservationPayload {
  url: string;
  title: string;
  headings: string[];
  visibleText: string[];
  contentItems?: string[];
  interactiveElements: InteractiveElement[];
  stats: ObservationStats;
}

export class ObservationEngine {
  private latestScreenshotBuffer: Buffer | null = null;
  private latestObservation: PageObservation | null = null;

  /**
   * Inspects the active Playwright page using browser-accessible standard APIs.
   * Treats the target application strictly as a black box.
   */
  async observePage(page: Page): Promise<PageObservation> {
    if (!page || page.isClosed()) {
      throw new Error('Cannot observe page: Browser page is closed or not available.');
    }

    // 1. Wait briefly for network/DOM settling if recently navigated
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
    } catch {
      // Non-blocking
    }

    // 2. Extract DOM observation using standard browser evaluation script
    // Note: Passed as raw string script so that Node/esbuild/tsx doesn't inject transpilation artifacts (like __name)
    const extractionScript = `
      (() => {
        const isElementVisible = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;

          const style = window.getComputedStyle(el);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) {
            return false;
          }
          return true;
        };

        const getAccessibleName = (el) => {
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl && labelEl.textContent) return labelEl.textContent.trim();
          }

          if (el.labels && el.labels.length > 0) {
            const labelText = el.labels[0].textContent;
            if (labelText && labelText.trim()) return labelText.trim();
          }

          const placeholder = el.getAttribute('placeholder');
          if (placeholder && placeholder.trim()) return placeholder.trim();

          const title = el.getAttribute('title');
          if (title && title.trim()) return title.trim();

          if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
            if (el.value && el.value.trim()) return el.value.trim();
          }

          const img = el.querySelector('img');
          if (img && img.alt && img.alt.trim()) return img.alt.trim();

          const textContent = el.innerText || el.textContent;
          if (textContent && textContent.trim()) {
            return textContent.replace(/\\s+/g, ' ').trim().slice(0, 80);
          }

          return '';
        };

        const getElementRole = (el) => {
          const explicitRole = el.getAttribute('role');
          if (explicitRole) return explicitRole.toLowerCase();

          const tagName = el.tagName.toLowerCase();
          if (tagName === 'a') return 'link';
          if (tagName === 'button') return 'button';
          if (tagName === 'textarea') return 'textbox';
          if (tagName === 'select') return 'combobox';
          if (tagName === 'input') {
            const type = (el.getAttribute('type') || 'text').toLowerCase();
            if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            if (type === 'search') return 'searchbox';
            return 'textbox';
          }
          return tagName;
        };

        const interactiveSelector = [
          'button',
          'a[href]',
          'input:not([type="hidden"])',
          'select',
          'textarea',
          '[role="button"]',
          '[role="link"]',
          '[role="textbox"]',
          '[role="searchbox"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="combobox"]',
          '[tabindex="0"]',
        ].join(', ');

        const elements = Array.from(document.querySelectorAll(interactiveSelector));
        const observedInteractive = [];
        const seenKeys = new Set();

        let btnCount = 0;
        let linkCount = 0;
        let inputCount = 0;
        let otherCount = 0;

        for (let i = 0; i < elements.length; i++) {
          const el = elements[i];
          if (!isElementVisible(el)) continue;

          const role = getElementRole(el);
          const name = getAccessibleName(el);
          const rawText = (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80);

          const dedupeKey = role + ':' + name + ':' + el.tagName;
          if (name && seenKeys.has(dedupeKey) && observedInteractive.length > 20) {
            continue;
          }
          if (name) seenKeys.add(dedupeKey);

          const disabled = Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true');
          const checked = Boolean(el.checked || el.getAttribute('aria-checked') === 'true');
          const expanded = el.getAttribute('aria-expanded') === 'true';

          let value = undefined;
          if (el.tagName === 'INPUT' && el.type !== 'password' && el.value) {
            value = el.value.slice(0, 50);
          }

          if (role === 'button') btnCount++;
          else if (role === 'link') linkCount++;
          else if (role === 'textbox' || role === 'searchbox' || role === 'combobox') inputCount++;
          else otherCount++;

          observedInteractive.push({
            id: 'elem_' + (observedInteractive.length + 1),
            role: role,
            name: name || ('(Unnamed ' + role + ')'),
            text: rawText && rawText !== name ? rawText : undefined,
            elementType: '<' + el.tagName.toLowerCase() + (el.getAttribute('type') ? ' type="' + el.getAttribute('type') + '"' : '') + '>',
            state: {
              disabled: disabled || undefined,
              checked: checked || undefined,
              expanded: expanded || undefined,
              value: value,
            },
          });

          if (observedInteractive.length >= 60) break;
        }

        const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
        const headings = headingElements
          .filter(isElementVisible)
          .map((h) => (h.innerText || '').replace(/\\s+/g, ' ').trim())
          .filter((t) => t.length > 0)
          .slice(0, 20);

        // Extract structured result cards, list items, and article entries
        const cardSelectors = [
          'li',
          '[role="listitem"]',
          'article',
          '[role="article"]',
          'tr',
          '[data-testid*="item"]',
          '[data-testid*="card"]',
          '[data-testid*="result"]',
          '[class*="ipc-metadata-list-summary-item"]',
          '[class*="result-item"]',
          '[class*="movie-card"]',
          '[class*="title-card"]'
        ].join(', ');

        const cardCandidates = Array.from(document.querySelectorAll(cardSelectors));
        const observedContentItems = [];
        const seenCardText = new Set();

        for (let c = 0; c < cardCandidates.length; c++) {
          const card = cardCandidates[c];
          if (!isElementVisible(card)) continue;

          // Exclude oversized layout wrappers
          const rect = card.getBoundingClientRect();
          if (rect.height > 900 || rect.width > 1600) continue;

          const text = (card.innerText || '').replace(/\\s+/g, ' ').trim();
          if (text.length >= 10 && text.length <= 400) {
            // Normalize for deduplication
            const norm = text.toLowerCase().slice(0, 80);
            if (!seenCardText.has(norm)) {
              seenCardText.add(norm);
              observedContentItems.push(text);
              if (observedContentItems.length >= 35) break;
            }
          }
        }

        // Extract paragraphs and key text blocks
        const textContainers = Array.from(
          document.querySelectorAll('p, blockquote, dt, dd, figcaption, [role="paragraph"]')
        );

        const visibleTextBlocks = [];
        const seenText = new Set();

        // Include key content items into visible text if available
        for (let k = 0; k < observedContentItems.length; k++) {
          const itemText = observedContentItems[k];
          seenText.add(itemText.toLowerCase().slice(0, 80));
          visibleTextBlocks.push(itemText);
          if (visibleTextBlocks.length >= 25) break;
        }

        for (let j = 0; j < textContainers.length; j++) {
          const block = textContainers[j];
          if (!isElementVisible(block)) continue;
          const text = (block.innerText || '').replace(/\\s+/g, ' ').trim();
          const norm = text.toLowerCase().slice(0, 80);
          if (text.length >= 12 && !seenText.has(norm)) {
            seenText.add(norm);
            visibleTextBlocks.push(text.slice(0, 250));
            if (visibleTextBlocks.length >= 35) break;
          }
        }

        if (visibleTextBlocks.length === 0 && document.body) {
          const bodySnippet = (document.body.innerText || '')
            .split('\\n')
            .map((s) => s.trim())
            .filter((s) => s.length >= 15)
            .slice(0, 20);
          visibleTextBlocks.push(...bodySnippet);
        }

        return {
          url: window.location.href,
          title: document.title || 'Untitled Page',
          headings: headings,
          visibleText: visibleTextBlocks,
          contentItems: observedContentItems,
          interactiveElements: observedInteractive,
          stats: {
            totalInteractiveCount: observedInteractive.length,
            buttonCount: btnCount,
            linkCount: linkCount,
            inputCount: inputCount,
            otherCount: otherCount,
          },
        };
      })()
    `;

    let rawDomObservation: DomObservationPayload;
    try {
      rawDomObservation = (await page.evaluate(extractionScript)) as DomObservationPayload;
    } catch (evalErr: any) {
      if (
        evalErr?.message?.includes('Execution context was destroyed') ||
        evalErr?.message?.includes('navigating')
      ) {
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000).catch(() => {});
        rawDomObservation = (await page.evaluate(extractionScript)) as DomObservationPayload;
      } else {
        throw evalErr;
      }
    }

    // 3. Capture real screenshot via Playwright
    let screenshotBase64: string | undefined;
    try {
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 75,
        fullPage: false,
      });
      this.latestScreenshotBuffer = buffer;
      screenshotBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (screenshotErr) {
      console.warn('[ObservationEngine] Screenshot capture failed:', screenshotErr);
    }

    const observation: PageObservation = {
      url: rawDomObservation.url,
      title: rawDomObservation.title,
      headings: rawDomObservation.headings,
      visibleText: rawDomObservation.visibleText,
      contentItems: rawDomObservation.contentItems || [],
      interactiveElements: rawDomObservation.interactiveElements,
      screenshotBase64,
      screenshotUrl: '/api/agent/screenshot',
      timestamp: new Date().toLocaleTimeString(),
      stats: rawDomObservation.stats,
    };

    this.latestObservation = observation;
    return observation;
  }

  getLatestScreenshot(): Buffer | null {
    return this.latestScreenshotBuffer;
  }

  getLatestObservation(): PageObservation | null {
    return this.latestObservation;
  }
}

export const observationEngine = new ObservationEngine();

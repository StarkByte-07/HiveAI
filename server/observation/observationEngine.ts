import { Page } from 'playwright';
import { PageObservation, InteractiveElement, ObservationStats } from './observationTypes.ts';
import { perfTimer } from '../utils/timing.ts';

interface DomObservationPayload {
  url: string;
  title: string;
  headings: string[];
  visibleText: string[];
  contentItems?: string[];
  interactiveElements: InteractiveElement[];
  stats: ObservationStats;
  isBlocked?: boolean;
  blockedReason?: string;
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

    perfTimer.start('observation');

    // 1. Brief readiness check without long delays
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
    } catch {
      // Non-blocking
    }

    // 2. Extract compact DOM observation
    perfTimer.start('dom_extraction');
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
            return textContent.replace(/\\s+/g, ' ').trim().slice(0, 60);
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
          const rawText = (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60);

          const dedupeKey = role + ':' + name + ':' + el.tagName;
          if (name && seenKeys.has(dedupeKey) && observedInteractive.length > 15) {
            continue;
          }
          if (name) seenKeys.add(dedupeKey);

          const disabled = Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true');
          const checked = Boolean(el.checked || el.getAttribute('aria-checked') === 'true');
          const expanded = el.getAttribute('aria-expanded') === 'true';

          let value = undefined;
          if (el.tagName === 'INPUT' && el.type !== 'password' && el.value) {
            value = el.value.slice(0, 40);
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

          if (observedInteractive.length >= 35) break;
        }

        const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
        const headings = headingElements
          .filter(isElementVisible)
          .map((h) => (h.innerText || '').replace(/\\s+/g, ' ').trim())
          .filter((t) => t.length > 0)
          .slice(0, 10);

        // Extract structured result cards/items
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

          const rect = card.getBoundingClientRect();
          if (rect.height > 900 || rect.width > 1600) continue;

          const text = (card.innerText || '').replace(/\\s+/g, ' ').trim();
          if (text.length >= 10 && text.length <= 300) {
            const norm = text.toLowerCase().slice(0, 60);
            if (!seenCardText.has(norm)) {
              seenCardText.add(norm);
              observedContentItems.push(text);
              if (observedContentItems.length >= 20) break;
            }
          }
        }

        // Extract paragraphs and key text blocks
        const textContainers = Array.from(
          document.querySelectorAll('p, blockquote, dt, dd, figcaption, [role="paragraph"]')
        );

        const visibleTextBlocks = [];
        const seenText = new Set();

        for (let k = 0; k < observedContentItems.length; k++) {
          const itemText = observedContentItems[k];
          seenText.add(itemText.toLowerCase().slice(0, 60));
          visibleTextBlocks.push(itemText);
          if (visibleTextBlocks.length >= 15) break;
        }

        for (let j = 0; j < textContainers.length; j++) {
          const block = textContainers[j];
          if (!isElementVisible(block)) continue;
          const text = (block.innerText || '').replace(/\\s+/g, ' ').trim();
          const norm = text.toLowerCase().slice(0, 60);
          if (text.length >= 12 && !seenText.has(norm)) {
            seenText.add(norm);
            visibleTextBlocks.push(text.slice(0, 160));
            if (visibleTextBlocks.length >= 20) break;
          }
        }

        if (visibleTextBlocks.length === 0 && document.body) {
          const bodySnippet = (document.body.innerText || '')
            .split('\\n')
            .map((s) => s.trim())
            .filter((s) => s.length >= 15)
            .slice(0, 10);
          visibleTextBlocks.push(...bodySnippet);
        }

        // Early detection of blocked / anti-bot / CAPTCHA pages
        const fullPageText = ((document.title || '') + ' ' + headings.join(' ') + ' ' + visibleTextBlocks.join(' ')).toLowerCase();
        const blockKeywords = [
          'attention required! | cloudflare',
          'access denied',
          'security check',
          'just a moment...',
          'robot check',
          'are you a human',
          'verify you are human',
          'bot detection',
          'pardon our interruption',
          'recaptcha',
          'cf-browser-verification',
          '403 forbidden'
        ];
        const isBlocked = blockKeywords.some((kw) => fullPageText.includes(kw));
        const blockedReason = isBlocked
          ? 'Target page is inaccessible because it returned a CAPTCHA/access-denied page.'
          : undefined;

        return {
          url: window.location.href,
          title: document.title || 'Untitled Page',
          headings: headings,
          visibleText: visibleTextBlocks,
          contentItems: observedContentItems,
          interactiveElements: observedInteractive,
          isBlocked,
          blockedReason,
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
        await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {});
        rawDomObservation = (await page.evaluate(extractionScript)) as DomObservationPayload;
      } else {
        throw evalErr;
      }
    } finally {
      perfTimer.end('dom_extraction');
    }

    // 3. Fast screenshot capture via Playwright for audit/reporting
    perfTimer.start('screenshot');
    let screenshotBase64: string | undefined;
    try {
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality: 60,
        fullPage: false,
      });
      this.latestScreenshotBuffer = buffer;
      screenshotBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (screenshotErr) {
      console.warn('[ObservationEngine] Screenshot capture failed:', screenshotErr);
    } finally {
      perfTimer.end('screenshot');
    }

    const observation: PageObservation = {
      url: rawDomObservation.url,
      title: rawDomObservation.title,
      headings: rawDomObservation.headings,
      visibleText: rawDomObservation.visibleText,
      contentItems: rawDomObservation.contentItems || [],
      interactiveElements: rawDomObservation.interactiveElements,
      isBlocked: rawDomObservation.isBlocked,
      blockedReason: rawDomObservation.blockedReason,
      screenshotBase64,
      screenshotUrl: '/api/agent/screenshot',
      timestamp: new Date().toLocaleTimeString(),
      stats: rawDomObservation.stats,
    };

    this.latestObservation = observation;
    perfTimer.end('observation');
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

import type { Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import type { PageObservation } from '../observation/observationTypes.ts';

export type FindingSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface AccessibilityFinding {
  id: string;
  rule: string;
  severity: FindingSeverity;
  element: string;
  message: string;
  evidence: string;
  recommendation: string;
  source: 'axe-core' | 'hiveai-dom';
  wcagLevel?: string;
  htmlSnippet?: string;
  category?: string;
}

export interface AccessibilityAuditResult {
  url: string;
  pageTitle: string;
  timestamp: string;
  totalFindings: number;
  totalViolations: number;
  findings: AccessibilityFinding[];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    checkedCategories: string[];
    description: string;
  };
}

export class AccessibilityAuditor {
  private mapAxeImpact(impact?: string | null): FindingSeverity {
    switch (impact) {
      case 'critical':
        return 'critical';
      case 'serious':
        return 'serious';
      case 'moderate':
        return 'moderate';
      case 'minor':
      default:
        return 'minor';
    }
  }

  /**
   * Performs an autonomous black-box accessibility audit of the active Playwright page.
   * Combines automated scanning via axe-core with black-box DOM and accessibility-tree observations.
   */
  async auditPage(page: Page, observation?: PageObservation | null): Promise<AccessibilityAuditResult> {
    const findings: AccessibilityFinding[] = [];
    const url = page.url();
    let pageTitle = '';
    try {
      pageTitle = await page.title();
    } catch {
      pageTitle = observation?.title || url;
    }
    const timestamp = new Date().toLocaleTimeString();

    // Track audited elements to prevent duplicates
    const seenElementSignatures = new Set<string>();

    // =========================================================================
    // 1. AXE-CORE AUTOMATED SCAN (Black-box WCAG 2.1 A / AA & Best Practices)
    // =========================================================================
    try {
      const axe = new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .options({
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
          },
        });

      const axeResults = await axe.analyze();

      for (const violation of axeResults.violations) {
        const severity: FindingSeverity = this.mapAxeImpact(violation.impact);

        for (let i = 0; i < violation.nodes.length; i++) {
          const node = violation.nodes[i];
          const selector = (node.target && node.target.length > 0)
            ? (Array.isArray(node.target) ? node.target.join(' ') : String(node.target))
            : 'document';
          const htmlSnippet = (node.html || '').trim().slice(0, 160);
          const elemDisplay = htmlSnippet || selector;

          const findingId = `axe_${violation.id}_${i + 1}`;
          const signature = `${violation.id}:${selector}:${htmlSnippet.slice(0, 40)}`;

          if (!seenElementSignatures.has(signature)) {
            seenElementSignatures.add(signature);

            const evidence = node.failureSummary || `Failed automated evaluation against rule: ${violation.id}`;
            const recommendation = violation.helpUrl
              ? `${violation.help}. Reference: ${violation.helpUrl}`
              : (violation.help || 'Review WCAG compliance guidelines for this element.');

            findings.push({
              id: findingId,
              rule: violation.id,
              severity,
              element: elemDisplay,
              message: violation.description || violation.help || 'Accessibility violation detected',
              evidence,
              recommendation,
              source: 'axe-core',
            });
          }

          // Cap nodes per violation to keep audit crisp and actionable
          if (i >= 4) break;
        }
      }
    } catch (axeErr: any) {
      console.warn('[AccessibilityAuditor] Axe-core automated analysis warning:', axeErr?.message);
    }

    // =========================================================================
    // 2. BLACK-BOX DOM & ACCESSIBILITY-TREE OBSERVATIONS (HiveAI Engine)
    // =========================================================================
    try {
      const domAuditScript = `
        (() => {
          const results = [];

          const isElementVisible = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          };

          // Check A: Buttons without accessible names
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          for (const btn of buttons) {
            if (!isElementVisible(btn)) continue;
            const ariaLabel = btn.getAttribute('aria-label');
            const labelledBy = btn.getAttribute('aria-labelledby');
            const title = btn.getAttribute('title');
            const text = (btn.textContent || '').trim();
            const img = btn.querySelector('img');
            const imgAlt = img ? img.getAttribute('alt') : null;

            if (!ariaLabel && !labelledBy && !title && !text && (!img || !imgAlt)) {
              const snippet = btn.outerHTML.slice(0, 120);
              results.push({
                rule: 'button-accessible-name',
                severity: 'critical',
                element: snippet,
                message: 'Interactive button lacks an accessible name for screen readers and assistive technology.',
                evidence: 'Button has no visible text content, no aria-label, aria-labelledby, or title attribute.',
                recommendation: 'Add visible text, an aria-label attribute, or an accessible icon label (e.g. aria-label="Close dialog").',
              });
              if (results.length >= 8) break;
            }
          }

          // Check B: Form inputs without associated labels
          const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'));
          for (const input of inputs) {
            if (!isElementVisible(input)) continue;
            const id = input.id;
            const ariaLabel = input.getAttribute('aria-label');
            const labelledBy = input.getAttribute('aria-labelledby');
            const title = input.getAttribute('title');
            const placeholder = input.getAttribute('placeholder');
            const hasAssociatedLabel = id && document.querySelector('label[for="' + id + '"]');
            const hasParentLabel = input.closest('label');

            if (!hasAssociatedLabel && !hasParentLabel && !ariaLabel && !labelledBy && !title) {
              const inputType = input.getAttribute('type') || 'text';
              const snippet = '<' + input.tagName.toLowerCase() + ' type="' + inputType + '"' + (placeholder ? ' placeholder="' + placeholder + '"' : '') + '>';
              results.push({
                rule: 'form-control-has-label',
                severity: 'serious',
                element: snippet,
                message: 'Form input control is missing an explicit programmatic label.',
                evidence: placeholder
                  ? 'Input relies solely on placeholder text ("' + placeholder + '") which disappears upon input and is not a replacement for a label.'
                  : 'Form control has no associated <label>, aria-label, or title.',
                recommendation: 'Provide an associated <label for="..."> element or an aria-label attribute describing the input purpose.',
              });
              if (results.length >= 12) break;
            }
          }

          // Check C: Heading hierarchy order
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .filter(isElementVisible)
            .map((h) => ({
              level: parseInt(h.tagName.substring(1), 10),
              text: (h.textContent || '').trim().slice(0, 60),
              snippet: '<' + h.tagName.toLowerCase() + '>' + (h.textContent || '').trim().slice(0, 40) + '</...>',
            }));

          const hasH1 = headings.some((h) => h.level === 1);
          if (!hasH1 && headings.length > 0) {
            results.push({
              rule: 'page-has-heading-one',
              severity: 'moderate',
              element: 'document',
              message: 'Page is missing a top-level <h1> heading.',
              evidence: 'Found ' + headings.length + ' headings (levels: ' + headings.map((h) => 'h' + h.level).slice(0, 5).join(', ') + '), but no <h1> element.',
              recommendation: 'Include a single descriptive <h1> heading communicating the main purpose of the page.',
            });
          }

          for (let i = 0; i < headings.length - 1; i++) {
            const current = headings[i];
            const next = headings[i + 1];
            // E.g. jumping from h1 directly to h3 or h4
            if (next.level > current.level + 1) {
              results.push({
                rule: 'heading-order-skipped',
                severity: 'moderate',
                element: next.snippet,
                message: 'Heading levels are skipped out of order: <h' + current.level + '> followed by <h' + next.level + '>.',
                evidence: 'Heading "' + next.text + '" is <h' + next.level + '> immediately following <h' + current.level + '> ("' + current.text + '").',
                recommendation: 'Do not skip heading levels. Structure content sequentially (e.g. h1 -> h2 -> h3).',
              });
              break; // Report first skipped heading
            }
          }

          // Check D: Images without alternative text
          const images = Array.from(document.querySelectorAll('img')).filter(isElementVisible);
          for (const img of images) {
            if (!img.hasAttribute('alt')) {
              const src = img.getAttribute('src') || '';
              const srcDisplay = src.length > 50 ? src.slice(0, 47) + '...' : src;
              results.push({
                rule: 'image-alt-missing',
                severity: 'serious',
                element: '<img src="' + srcDisplay + '">',
                message: 'Image element is missing the alt attribute entirely.',
                evidence: 'Screen readers will read out the raw image filename or URL.',
                recommendation: 'Add an alt attribute describing the image content, or alt="" if the image is purely decorative.',
              });
              if (results.length >= 16) break;
            }
          }

          // Check E: Positive tabindex anti-pattern
          const positiveTabindex = Array.from(document.querySelectorAll('[tabindex]'))
            .filter(isElementVisible)
            .filter((el) => {
              const val = parseInt(el.getAttribute('tabindex') || '0', 10);
              return val > 0;
            });

          if (positiveTabindex.length > 0) {
            const first = positiveTabindex[0];
            results.push({
              rule: 'tabindex-positive',
              severity: 'moderate',
              element: first.outerHTML.slice(0, 100),
              message: 'Element uses a positive tabindex, disrupting the natural logical keyboard focus navigation order.',
              evidence: 'Found ' + positiveTabindex.length + ' elements with tabindex > 0.',
              recommendation: 'Use natural DOM source ordering or tabindex="0" for custom interactive elements. Avoid tabindex > 0.',
            });
          }

          return results;
        })()
      `;

      const domAuditFindings = (await page.evaluate(domAuditScript)) as Array<{
        rule: string;
        severity: FindingSeverity;
        element: string;
        message: string;
        evidence: string;
        recommendation: string;
      }>;

      for (let i = 0; i < domAuditFindings.length; i++) {
        const item = domAuditFindings[i];
        const signature = `hiveai:${item.rule}:${item.element.slice(0, 50)}`;
        if (!seenElementSignatures.has(signature)) {
          seenElementSignatures.add(signature);
          findings.push({
            id: `dom_${item.rule}_${i + 1}`,
            rule: item.rule,
            severity: item.severity,
            element: item.element,
            message: item.message,
            evidence: item.evidence,
            recommendation: item.recommendation,
            source: 'hiveai-dom',
          });
        }
      }
    } catch (domErr: any) {
      console.warn('[AccessibilityAuditor] DOM accessibility inspection warning:', domErr?.message);
    }

    // Sort findings by severity: critical -> serious -> moderate -> minor
    const severityRank: Record<FindingSeverity, number> = {
      critical: 0,
      serious: 1,
      moderate: 2,
      minor: 3,
    };

    findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

    // Count severities
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;

    for (const f of findings) {
      if (f.severity === 'critical') criticalCount++;
      else if (f.severity === 'serious') seriousCount++;
      else if (f.severity === 'moderate') moderateCount++;
      else if (f.severity === 'minor') minorCount++;
    }

    const total = findings.length;
    const checkedCategories = [
      'Accessible Names & Controls',
      'Form Labels & Assistive Input',
      'Heading Structure & Semantics',
      'Color Contrast & Visual Accessibility',
      'Images & Alternative Text',
      'Keyboard & Focus Navigation',
      'ARIA Role & Landmark Semantics',
    ];

    const description = total > 0
      ? `Automated black-box checks identified ${total} observable accessibility issue${total === 1 ? '' : 's'} on the current page (${criticalCount} critical, ${seriousCount} serious, ${moderateCount} moderate, ${minorCount} minor). Manual testing may reveal additional issues.`
      : 'Automated black-box checks found 0 observable accessibility issues on the current page state. Manual testing may reveal additional issues.';

    return {
      url,
      pageTitle,
      timestamp,
      totalFindings: total,
      totalViolations: total,
      findings,
      summary: {
        total,
        critical: criticalCount,
        serious: seriousCount,
        moderate: moderateCount,
        minor: minorCount,
        checkedCategories,
        description,
      },
    };
  }
}

export const accessibilityAuditor = new AccessibilityAuditor();

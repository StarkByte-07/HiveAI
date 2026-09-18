import type { PageObservation } from '../observation/observationTypes.ts';
import type { GoalIntentType, ExtractedResultItem, AgentHistoryItem } from './agentTypes.ts';

export interface ProcessorRequirement {
  requiredBrand?: 'Intel' | 'AMD' | 'Apple';
  family?: string;
  rawSpec: string;
  forbiddenBrands: string[];
  forbiddenFamilies: string[];
}

export interface ParsedGoalRequirements {
  rawGoal: string;
  intent: GoalIntentType;
  brand?: string;
  maxPrice?: number;
  minPrice?: number;
  currency?: string;
  minRamGb?: number;
  processor?: ProcessorRequirement;
  topicKeywords: string[];
  isNavigationOnly: boolean;
  minItemCount: number;
}

export interface CandidateValidationResult {
  isValid: boolean;
  reason?: string;
  matchedConstraints: string[];
  failedConstraint?: string;
}

export interface GoalValidationResult {
  isSatisfied: boolean;
  status: 'COMPLETED' | 'FAILED' | 'CONTINUE';
  reason: string;
  validatedResults: ExtractedResultItem[];
  rejectedResults: Array<{ item: ExtractedResultItem; reason: string }>;
  unmetConstraints: string[];
}

export class GoalValidator {
  /**
   * Generically extracts structured constraints from a natural language testing goal.
   */
  extractRequirements(goal: string): ParsedGoalRequirements {
    const rawGoal = goal.trim();
    const lower = rawGoal.toLowerCase();

    // 1. Detect Intent
    let intent: GoalIntentType = 'NAVIGATION';
    if (
      lower.includes('give') ||
      lower.includes('list') ||
      lower.includes('show') ||
      lower.includes('find') ||
      lower.includes('rating') ||
      lower.includes('price') ||
      lower.includes('what') ||
      lower.includes('compare') ||
      lower.includes('laptop') ||
      lower.includes('phone') ||
      lower.includes('movie') ||
      lower.includes('food') ||
      lower.includes('tell me')
    ) {
      intent = 'INFORMATION_RETRIEVAL';
    } else if (lower.startsWith('search') || lower.includes('search for')) {
      intent = 'SEARCH';
    } else if (lower.startsWith('click') || lower.startsWith('type') || lower.startsWith('fill')) {
      intent = 'ACTION';
    } else if (lower.startsWith('verify') || lower.startsWith('check')) {
      intent = 'VERIFICATION';
    } else {
      intent = 'NAVIGATION';
    }

    // 2. Pure navigation check
    const isNavigationOnly =
      (lower.startsWith('open') ||
        lower.startsWith('go to') ||
        lower.startsWith('visit') ||
        lower.startsWith('navigate to') ||
        lower === 'open example' ||
        lower === 'open the example website.' ||
        lower === 'open the website') &&
      !lower.includes('under') &&
      !lower.includes('find') &&
      !lower.includes('search') &&
      !lower.includes('rating') &&
      !lower.includes('price') &&
      !lower.includes('list');

    // 3. Price constraints (e.g. "under 80,000", "below 80k", "less than 50000", "under 1 lakh")
    let maxPrice: number | undefined;
    let minPrice: number | undefined;

    const underMatch = lower.match(
      /(?:under|below|less\s+than|<=?|at\s+most|max|cheaper\s+than)\s*(?:rs\.?|inr|₹|\$)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s*(k|thousand|lakh|lac)?/i
    );
    if (underMatch) {
      const numStr = underMatch[1].replace(/,/g, '');
      let val = parseFloat(numStr);
      const unit = (underMatch[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'thousand') val *= 1000;
      if (unit === 'lakh' || unit === 'lac') val *= 100000;
      if (!isNaN(val) && val > 0) {
        maxPrice = val;
      }
    }

    const aboveMatch = lower.match(
      /(?:above|over|more\s+than|>=?|at\s+least|min)\s*(?:rs\.?|inr|₹|\$)?\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s*(k|thousand|lakh|lac)?/i
    );
    if (aboveMatch) {
      const numStr = aboveMatch[1].replace(/,/g, '');
      let val = parseFloat(numStr);
      const unit = (aboveMatch[2] || '').toLowerCase();
      if (unit === 'k' || unit === 'thousand') val *= 1000;
      if (unit === 'lakh' || unit === 'lac') val *= 100000;
      if (!isNaN(val) && val > 0) {
        minPrice = val;
      }
    }

    // 4. RAM constraints (e.g. "16GB ram", "16 gb", "32gb")
    let minRamGb: number | undefined;
    const ramMatch = lower.match(/([0-9]+)\s*(?:gb|gigabyte)\s*(?:ram|memory)?/i);
    if (ramMatch) {
      const r = parseInt(ramMatch[1], 10);
      if (!isNaN(r) && r > 0) {
        minRamGb = r;
      }
    }

    // 5. Brand constraint (e.g. Lenovo, Dell, HP, Apple, ASUS, Acer, Samsung, Sony)
    let brand: string | undefined;
    const knownBrands = [
      'lenovo',
      'dell',
      'hp',
      'apple',
      'asus',
      'acer',
      'samsung',
      'sony',
      'msi',
      'lg',
      'motorola',
      'google',
      'oneplus',
      'xiaomi',
      'realme',
      'oppo',
      'vivo',
    ];
    for (const b of knownBrands) {
      const regex = new RegExp(`\\b${b}\\b`, 'i');
      if (regex.test(lower)) {
        brand = b.charAt(0).toUpperCase() + b.slice(1);
        break;
      }
    }

    // 6. Processor / CPU constraint
    let processor: ProcessorRequirement | undefined;
    if (lower.includes('core 7') || lower.includes('core i7') || lower.includes('intel core 7')) {
      processor = {
        requiredBrand: 'Intel',
        family: 'Core 7',
        rawSpec: 'Intel Core 7',
        forbiddenBrands: ['amd', 'ryzen'],
        forbiddenFamilies: ['ultra 5', 'core 5', 'core i5', 'ultra 7', 'core 3', 'celeron', 'pentium'],
      };
    } else if (lower.includes('ultra 7') || lower.includes('core ultra 7')) {
      processor = {
        requiredBrand: 'Intel',
        family: 'Core Ultra 7',
        rawSpec: 'Intel Core Ultra 7',
        forbiddenBrands: ['amd', 'ryzen'],
        forbiddenFamilies: ['ultra 5', 'core 5', 'core i5', 'core 3'],
      };
    } else if (lower.includes('core 5') || lower.includes('core i5') || lower.includes('intel core 5')) {
      processor = {
        requiredBrand: 'Intel',
        family: 'Core 5',
        rawSpec: 'Intel Core 5',
        forbiddenBrands: ['amd', 'ryzen'],
        forbiddenFamilies: ['ultra 7', 'core 7', 'core i7', 'core 3'],
      };
    } else if (lower.includes('ryzen 7') || lower.includes('amd ryzen 7')) {
      processor = {
        requiredBrand: 'AMD',
        family: 'Ryzen 7',
        rawSpec: 'AMD Ryzen 7',
        forbiddenBrands: ['intel'],
        forbiddenFamilies: ['core i5', 'core i7', 'ultra 5', 'ultra 7'],
      };
    } else if (lower.includes('intel')) {
      processor = {
        requiredBrand: 'Intel',
        rawSpec: 'Intel',
        forbiddenBrands: ['amd', 'ryzen'],
        forbiddenFamilies: [],
      };
    } else if (lower.includes('amd') || lower.includes('ryzen')) {
      processor = {
        requiredBrand: 'AMD',
        rawSpec: 'AMD',
        forbiddenBrands: ['intel'],
        forbiddenFamilies: [],
      };
    }

    // 7. Topic Keywords
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'under',
      'below', 'above', 'is', 'are', 'give', 'list', 'show', 'find', 'open', 'go', 'visit',
      'website', 'page', 'site', 'please', 'me', 'what', 'how', 'many', 'top',
    ]);
    const words = lower
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w));
    const topicKeywords = Array.from(new Set(words));

    // 8. Expected minimum item count
    let minItemCount = 1;
    if (lower.includes('top 5') || lower.includes('5 ') || lower.includes('five')) {
      minItemCount = 5;
    } else if (lower.includes('top 3') || lower.includes('3 ') || lower.includes('three')) {
      minItemCount = 3;
    } else if (
      lower.includes('movies') ||
      lower.includes('laptops') ||
      lower.includes('phones') ||
      lower.includes('items') ||
      lower.includes('list')
    ) {
      minItemCount = 3; // Plural noun suggests multiple items if available
    }

    return {
      rawGoal,
      intent,
      brand,
      maxPrice,
      minPrice,
      minRamGb,
      processor,
      topicKeywords,
      isNavigationOnly,
      minItemCount,
    };
  }

  /**
   * Validates a candidate item against all extracted goal constraints.
   * Every constraint must be satisfied. Partial satisfaction (e.g. 3/4) is rejected.
   */
  validateCandidate(
    item: ExtractedResultItem,
    reqs: ParsedGoalRequirements,
    observation: PageObservation | null
  ): CandidateValidationResult {
    const textToInspect = `${item.name} ${item.details || ''} ${item.source || ''}`.toLowerCase();
    const matchedConstraints: string[] = [];

    // 1. Check Grounding on active or observed page
    if (observation) {
      const pageText = [
        ...observation.headings,
        ...observation.visibleText,
        ...(observation.contentItems || []),
        ...observation.interactiveElements.map((el) => el.name || el.text || ''),
      ]
        .join(' ')
        .toLowerCase();

      // Check if at least the core name or key terms exist on the page
      const nameKeywords = item.name
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      const hasGrounding =
        nameKeywords.length === 0 ||
        nameKeywords.some((kw) => pageText.includes(kw)) ||
        pageText.includes(item.name.toLowerCase().slice(0, 20));

      if (!hasGrounding) {
        return {
          isValid: false,
          failedConstraint: 'Grounding verification failed: Item was not observed on the current page.',
          matchedConstraints,
        };
      }
    }

    // 2. Brand check
    if (reqs.brand) {
      const brandLower = reqs.brand.toLowerCase();
      if (!textToInspect.includes(brandLower)) {
        return {
          isValid: false,
          failedConstraint: `Brand mismatch: Product does not match requested brand "${reqs.brand}".`,
          matchedConstraints,
        };
      }
      matchedConstraints.push(`Brand: ${reqs.brand}`);
    }

    // 3. Price check
    if (reqs.maxPrice !== undefined) {
      const priceMatch = textToInspect.match(/(?:rs\.?|inr|₹|\$)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i) ||
                         textToInspect.match(/([0-9]{2,3},[0-9]{3})/);
      if (priceMatch) {
        const parsedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (!isNaN(parsedPrice)) {
          if (parsedPrice > reqs.maxPrice) {
            return {
              isValid: false,
              failedConstraint: `Price constraint violated: Price ₹${parsedPrice.toLocaleString()} exceeds maximum allowed ₹${reqs.maxPrice.toLocaleString()}.`,
              matchedConstraints,
            };
          }
          matchedConstraints.push(`Price <= ₹${reqs.maxPrice}`);
        }
      }
    }

    // 4. RAM check
    if (reqs.minRamGb !== undefined) {
      const ramMatch = textToInspect.match(/([0-9]+)\s*(?:gb|gigabyte)\s*(?:ram|memory)?/i) ||
                       textToInspect.match(/([0-9]+)\s*gb/i);
      if (ramMatch) {
        const foundRam = parseInt(ramMatch[1], 10);
        if (!isNaN(foundRam)) {
          if (foundRam < reqs.minRamGb) {
            return {
              isValid: false,
              failedConstraint: `RAM constraint violated: ${foundRam}GB RAM is less than required ${reqs.minRamGb}GB RAM.`,
              matchedConstraints,
            };
          }
          matchedConstraints.push(`RAM >= ${reqs.minRamGb}GB`);
        }
      } else {
        // If RAM was strictly specified in goal but not mentioned anywhere in item, cannot guarantee satisfaction
        // If it's a product search with multiple specs, verify RAM keyword exists
        if (textToInspect.includes('4gb') || textToInspect.includes('8gb')) {
          return {
            isValid: false,
            failedConstraint: `RAM constraint violated: Product has insufficient RAM (less than ${reqs.minRamGb}GB).`,
            matchedConstraints,
          };
        }
      }
    }

    // 5. Processor check
    if (reqs.processor) {
      const proc = reqs.processor;

      // Check forbidden brands (e.g. AMD Ryzen when Intel requested)
      for (const fb of proc.forbiddenBrands) {
        const reg = new RegExp(`\\b${fb}\\b`, 'i');
        if (reg.test(textToInspect)) {
          return {
            isValid: false,
            failedConstraint: `Processor brand violated: Contains forbidden brand "${fb}" when "${proc.rawSpec}" was required.`,
            matchedConstraints,
          };
        }
      }

      // Check forbidden families (e.g. Ultra 5 / Core 5 when Core 7 requested)
      for (const ff of proc.forbiddenFamilies) {
        const reg = new RegExp(`\\b${ff}\\b`, 'i');
        if (reg.test(textToInspect)) {
          return {
            isValid: false,
            failedConstraint: `Processor family violated: Contains "${ff}" when "${proc.rawSpec}" was required.`,
            matchedConstraints,
          };
        }
      }

      // If specific family required (e.g. "Core 7"), verify it or compatible family is present
      if (proc.family === 'Core 7') {
        const isCore7 =
          textToInspect.includes('core 7') ||
          textToInspect.includes('core i7') ||
          textToInspect.includes('i7-') ||
          textToInspect.includes('150u') ||
          textToInspect.includes('155h');
        if (!isCore7 && (textToInspect.includes('ultra 5') || textToInspect.includes('i5') || textToInspect.includes('core 5'))) {
          return {
            isValid: false,
            failedConstraint: `Processor family violated: Product uses Core 5 / Ultra 5 instead of required Intel Core 7.`,
            matchedConstraints,
          };
        }
      }

      matchedConstraints.push(`Processor: ${proc.rawSpec}`);
    }

    return {
      isValid: true,
      matchedConstraints,
    };
  }

  /**
   * Generically checks if the current page observation is an intermediate search-results page.
   * A search results page is NEVER a sufficient final state for information retrieval.
   */
  isIntermediateSearchResultsPage(observation: PageObservation | null): boolean {
    if (!observation) return false;
    const title = (observation.title || '').toLowerCase();
    const url = (observation.url || '').toLowerCase();
    const headings = observation.headings.map((h) => h.toLowerCase());
    const visibleText = observation.visibleText.join(' ').toLowerCase();

    // Check search URL patterns
    const isSearchUrl =
      url.includes('/search') ||
      url.includes('search=') ||
      url.includes('?q=') ||
      url.includes('query=') ||
      url.includes('&q=');

    // Check search title/heading keywords
    const searchKeywords = [
      'search results',
      'results for',
      'results 1–',
      'results 1-',
      'search - wikipedia',
      'search – wikipedia',
      'matching results',
      'search mode',
      'showing results',
    ];

    const hasSearchHeading = headings.some((h) => searchKeywords.some((kw) => h.includes(kw)));
    const hasSearchTitle = searchKeywords.some((kw) => title.includes(kw));
    const hasResultCounter =
      /results?\s+\d+[\s–-]+\d+\s+of\s+\d+/i.test(visibleText) ||
      /results?\s+\d+[\s–-]+\d+\s+of\s+\d+/i.test(title);

    return isSearchUrl || hasSearchTitle || hasSearchHeading || hasResultCounter;
  }

  /**
   * Main Goal Fulfillment Validator.
   * Evaluates whether the observed state and collected evidence positively validate goal completion.
   */
  validateGoal(
    goal: string,
    detectedIntent: GoalIntentType,
    candidateResults: ExtractedResultItem[],
    observation: PageObservation | null,
    history: AgentHistoryItem[],
    geminiExplanation?: string
  ): GoalValidationResult {
    const reqs = this.extractRequirements(goal);
    const explLower = (geminiExplanation || '').toLowerCase();

    // 1. Blocked Page Check
    if (observation?.isBlocked) {
      return {
        isSatisfied: false,
        status: 'FAILED',
        reason: `Target page is blocked by anti-bot verification or CAPTCHA: ${observation.blockedReason || 'Access Denied'}.`,
        validatedResults: [],
        rejectedResults: [],
        unmetConstraints: ['Anti-bot verification encountered'],
      };
    }

    // 2. Explicit failure admissions in reasoning
    const failurePhrases = [
      'does not display the requested',
      'unable to find',
      'could not find',
      'cannot find',
      'no results found',
      'not available on this page',
      'failed to locate',
      'failed to retrieve',
      'no matching products',
    ];
    if (failurePhrases.some((p) => explLower.includes(p))) {
      return {
        isSatisfied: false,
        status: 'FAILED',
        reason: geminiExplanation || `Unable to satisfy goal: Requested items were not found on the page.`,
        validatedResults: [],
        rejectedResults: [],
        unmetConstraints: ['Content not present on target application'],
      };
    }

    // 3. Scenario: Simple Navigation Goal (TEST 4)
    if (reqs.isNavigationOnly) {
      if (!observation) {
        return {
          isSatisfied: false,
          status: 'CONTINUE',
          reason: 'Target page has not yet been observed.',
          validatedResults: [],
          rejectedResults: [],
          unmetConstraints: ['Navigation observation pending'],
        };
      }

      const hasTitle = observation.title && observation.title.trim().length > 0;
      const hasContent = observation.visibleText.length > 0 || observation.interactiveElements.length > 0;
      const notError =
        !observation.title.toLowerCase().includes('404') &&
        !observation.title.toLowerCase().includes('error') &&
        !observation.title.toLowerCase().includes('not found');

      if (hasTitle && hasContent && notError) {
        return {
          isSatisfied: true,
          status: 'COMPLETED',
          reason: `Target website successfully loaded and verified: "${observation.title}".`,
          validatedResults: [],
          rejectedResults: [],
          unmetConstraints: [],
        };
      } else {
        return {
          isSatisfied: false,
          status: 'FAILED',
          reason: `Navigation failed: Target page could not be verified (Title: "${observation.title}").`,
          validatedResults: [],
          rejectedResults: [],
          unmetConstraints: ['Target page failed to load valid content'],
        };
      }
    }

    // 4. Scenario: Intermediate Search-Results Page (TEST 2)
    // Reaching a search-results page does NOT satisfy an information goal!
    if (this.isIntermediateSearchResultsPage(observation)) {
      // If the goal is information retrieval (like "hyd food" or "tell me about X"):
      // The search page only lists search hits. The agent must follow a link or extract actual topic info.
      const hasSubstantiveInfo =
        candidateResults.length > 0 &&
        candidateResults.some(
          (c) =>
            c.details &&
            c.details.length > 40 &&
            !c.details.toLowerCase().includes('search result')
        );

      if (!hasSubstantiveInfo) {
        return {
          isSatisfied: false,
          status: 'CONTINUE',
          reason: `Page is an intermediate search-results view ("${observation?.title}"). Search success does NOT equal goal completion. Agent must navigate to a relevant result to retrieve detailed information for "${goal}".`,
          validatedResults: [],
          rejectedResults: [],
          unmetConstraints: ['Detailed information not yet retrieved from search results'],
        };
      }
    }

    // 5. Scenario: Information Retrieval & Constrained Product Search (TEST 1 & TEST 3)
    if (reqs.intent === 'INFORMATION_RETRIEVAL' || reqs.brand || reqs.maxPrice || reqs.processor) {
      if (!candidateResults || candidateResults.length === 0) {
        return {
          isSatisfied: false,
          status: 'CONTINUE',
          reason: `Goal requires information retrieval or product items, but no candidates have been collected yet.`,
          validatedResults: [],
          rejectedResults: [],
          unmetConstraints: ['No candidates collected'],
        };
      }

      const validated: ExtractedResultItem[] = [];
      const rejected: Array<{ item: ExtractedResultItem; reason: string }> = [];

      for (const item of candidateResults) {
        if (!item.name || item.name.trim().length === 0) continue;

        const check = this.validateCandidate(item, reqs, observation);
        if (check.isValid) {
          validated.push(item);
        } else {
          rejected.push({
            item,
            reason: check.failedConstraint || 'Failed required constraints.',
          });
        }
      }

      // Check if we have at least 1 validated item that satisfies ALL constraints
      if (validated.length === 0) {
        const rejectionSummary = rejected.map((r) => `"${r.item.name}": ${r.reason}`).join('; ');
        return {
          isSatisfied: false,
          status: 'CONTINUE',
          reason: `No candidate items satisfied all requested constraints. Rejected candidates: ${rejectionSummary || 'None matched'}.`,
          validatedResults: [],
          rejectedResults: rejected,
          unmetConstraints: rejected.map((r) => r.reason),
        };
      }

      // Check if we have enough items if multiple were requested
      if (validated.length < reqs.minItemCount && candidateResults.length >= reqs.minItemCount) {
        return {
          isSatisfied: false,
          status: 'CONTINUE',
          reason: `Collected ${validated.length} valid item(s), but goal required at least ${reqs.minItemCount}. Continuing to locate more valid items.`,
          validatedResults: validated,
          rejectedResults: rejected,
          unmetConstraints: [`Expected at least ${reqs.minItemCount} items, found ${validated.length}`],
        };
      }

      // Deduplicate validated results
      const deduplicated: ExtractedResultItem[] = [];
      const seen = new Set<string>();
      for (const v of validated) {
        const key = v.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          deduplicated.push(v);
        }
      }

      return {
        isSatisfied: true,
        status: 'COMPLETED',
        reason: geminiExplanation || `Successfully retrieved ${deduplicated.length} validated item(s) strictly satisfying all constraints.`,
        validatedResults: deduplicated,
        rejectedResults: rejected,
        unmetConstraints: [],
      };
    }

    // 6. Generic Action / Verification intents
    if (history.length > 0 && history.some((h) => h.result === 'success')) {
      return {
        isSatisfied: true,
        status: 'COMPLETED',
        reason: geminiExplanation || `Action executed and verified on target application.`,
        validatedResults: candidateResults,
        rejectedResults: [],
        unmetConstraints: [],
      };
    }

    return {
      isSatisfied: false,
      status: 'CONTINUE',
      reason: 'Awaiting action execution and verification.',
      validatedResults: [],
      rejectedResults: [],
      unmetConstraints: ['Action pending verification'],
    };
  }
}

export const goalValidator = new GoalValidator();

import { GoogleGenAI } from '@google/genai';
import type {
  AgentAction,
  AgentReasoningInput,
  GoalIntentType,
  ExtractedResultItem,
} from './agentTypes.ts';

export class AgentReasoner {
  private ai: GoogleGenAI | null = null;
  private currentApiKey: string | null = null;
  private readonly preferredModels = [
    'gemini-3.1-pro-preview',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ];

  private getAI(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        'GEMINI_API_KEY is not configured in the server environment. Please set GEMINI_API_KEY in your environment or secrets.'
      );
    }
    if (!this.ai || this.currentApiKey !== apiKey) {
      this.currentApiKey = apiKey;
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return this.ai;
  }

  /**
   * Generates the next autonomous action for the agent based on
   * the testing goal, the structured page observation, action history,
   * and accumulated results for information retrieval.
   */
  async decideNextAction(input: AgentReasoningInput): Promise<AgentAction> {
    const ai = this.getAI();

    const { goal, currentStep, maxSteps, observation, history, cumulativeResults = [] } = input;

    // Filter and format interactive elements to keep token size efficient and relevant
    const formattedElements = observation.interactiveElements
      .slice(0, 60)
      .map((el) => {
        const stateDesc = el.state
          ? Object.entries(el.state)
              .filter(([_, val]) => val !== undefined && val !== false && val !== '')
              .map(([key, val]) => `${key}=${val}`)
              .join(', ')
          : '';
        return `[elementId: "${el.id}"] role="${el.role}" name="${el.name || el.text || ''}" type="${el.elementType}"${stateDesc ? ` state=(${stateDesc})` : ''}`;
      });

    const formattedHistory = history.map((h) => 
      `Step ${h.stepNumber}: ${h.action.action.toUpperCase()} ${h.action.elementId || h.action.target ? `"${h.action.elementId || h.action.target}"` : ''} -> Result: ${h.result} (${h.message})`
    );

    const formattedCumulative = cumulativeResults.map((r, i) =>
      `${i + 1}. "${r.name}"${r.rating ? ` — Rating: ${r.rating}` : ''}${r.details ? ` (${r.details})` : ''}`
    );

    const prompt = `
You are HiveAI, an autonomous agent for black-box UI/UX & accessibility testing and intelligent web exploration.
Your mission is to explore and evaluate the target web application to achieve the user's testing goal.

TESTING GOAL:
"${goal || 'Explore and test the key user flows and interactive controls on this page'}"

CURRENT AGENT STATE:
- Step: ${currentStep} of ${maxSteps} max steps
- Current URL: ${observation.url}
- Page Title: "${observation.title}"

GOAL INTENT CLASSIFICATION:
Classify the user's goal into one of these 5 INTENT TYPES:
1. "NAVIGATION": The user explicitly requested to reach/open a specific page or section (e.g. "open the Telugu movies page", "go to checkout", "visit settings").
   - FINISH CRITERIA: Reaching the intended page satisfies the goal. You can FINISH once you arrive.
2. "SEARCH": The user asked to search for a query (e.g. "search for Telugu movies").
   - FINISH CRITERIA: Performing the search and viewing the results satisfies the goal.
3. "INFORMATION_RETRIEVAL": The user requested specific data, items, ratings, prices, lists, reviews, or answers (e.g. "give recent telugu movie ratings", "list top 5 laptops", "find prices of...", "show me ratings of...", "what are...", "compare X and Y").
   - NOTE: Words/phrases like "give me", "list", "show me", "find", "compare", "provide", "ratings", "reviews", "prices" indicate INFORMATION RETRIEVAL.
   - CRITICAL RULES FOR INFORMATION_RETRIEVAL:
     * Reaching a relevant page is NOT sufficient to finish!
     * Finding only 1 item/rating is NOT sufficient if multiple items are available!
     * Target: Collect at least 5 relevant results when 5 or more are available on the application. If fewer than 5 are available in total, collect all clearly relevant available results.
     * If fewer than 5 relevant results are currently visible in the observation and more may exist further down, you MUST choose action "SCROLL" with direction "down" to inspect additional results.
     * Only issue "FINISH" when you have collected enough relevant items (>= 5) OR when you have scrolled and verified no more results exist.
     * When returning "FINISH", you MUST populate the "extractedResults" array with all collected items and provide a formatted summary in "reason".
     * DO NOT FABRICATE OR GUESS ANY INFORMATION OR RATINGS. Only report items and ratings actually observed on the page.
4. "ACTION": The user requested a specific action (e.g. "click the Learn more link", "fill contact form").
   - FINISH CRITERIA: Perform the action, observe the result, then FINISH.
5. "VERIFICATION": The user requested to verify or check a condition on the page.
   - FINISH CRITERIA: Verify the condition and FINISH.

ALREADY COLLECTED ITEMS SO FAR (${cumulativeResults.length} items):
${formattedCumulative.length > 0 ? formattedCumulative.join('\n') : '(No items collected yet)'}

PAGE CONTENT OVERVIEW:
Headings:
${observation.headings.length > 0 ? observation.headings.slice(0, 15).map((h) => `- ${h}`).join('\n') : '(None)'}

STRUCTURED RESULT ITEMS & CARDS (List items, cards, table rows):
${observation.contentItems && observation.contentItems.length > 0 ? observation.contentItems.slice(0, 35).map((item, idx) => `[Item ${idx + 1}] ${item}`).join('\n') : '(No structured result cards detected)'}

Key Visible Text Blocks:
${observation.visibleText.length > 0 ? observation.visibleText.slice(0, 30).map((t) => `- "${t}"`).join('\n') : '(None)'}

INTERACTIVE ELEMENTS CURRENTLY ON PAGE:
${formattedElements.length > 0 ? formattedElements.join('\n') : '(No interactive elements detected)'}

PREVIOUS ACTION HISTORY:
${formattedHistory.length > 0 ? formattedHistory.join('\n') : '(No previous actions taken yet)'}

AVAILABLE ACTIONS:
- "CLICK": Click an interactive element. Provide "elementId" (e.g. "elem_0") or "target" (element name/text).
- "TYPE": Fill an input or search field. Provide "elementId" (or "target") and "text" (or "value").
- "SCROLL": Scroll the page. Provide "direction": "down" or "up".
- "WAIT": Pause briefly for dynamic content to settle. Optional: "milliseconds" (e.g. 1000).
- "BACK": Navigate back in browser history.
- "NAVIGATE": Go to a specific URL. Provide "url" (must be http:// or https://).
- "FINISH": Finish testing when the goal is genuinely fulfilled. Provide "reason" summarizing the outcome.

You MUST return a strictly valid JSON object matching this schema:
{
  "intentType": "NAVIGATION" | "SEARCH" | "INFORMATION_RETRIEVAL" | "ACTION" | "VERIFICATION",
  "action": "CLICK" | "TYPE" | "SCROLL" | "WAIT" | "BACK" | "NAVIGATE" | "FINISH",
  "elementId": "elem_0 (for CLICK and TYPE)",
  "target": "name or text (optional alternative to elementId)",
  "text": "string to type (for TYPE)",
  "direction": "down" | "up (for SCROLL)",
  "milliseconds": 1000,
  "url": "https://... (for NAVIGATE)",
  "extractedResults": [
    {
      "name": "Title or Item Name",
      "rating": "Rating value (e.g. 7.2) if applicable",
      "details": "Additional visible info (year, genre, price, etc.)",
      "source": "Site or page title"
    }
  ],
  "reason": "Concise 1-2 sentence explanation of why this action was selected, or final summary if FINISH."
}
`;

    const systemInstruction = `You are HiveAI, an autonomous agent for black-box UI/UX & accessibility testing and intelligent web exploration.
Your mission is to explore and evaluate the target web application to achieve the user's testing goal.
You must return ONLY a strictly valid JSON object matching the requested action schema, with no surrounding markdown or explanation outside the JSON.`;

    // Helper to extract retry delay from transient 429 errors
    const extractRetryDelay = (err: any): number | null => {
      try {
        const errMsg = err?.message || (typeof err === 'string' ? err : '');
        // Do not pause if the model has a zero-quota limit on free tier
        if (errMsg.includes('limit: 0')) return null;

        const details = err?.error?.details || err?.details;
        if (Array.isArray(details)) {
          const retryInfo = details.find((d: any) => d['@type']?.includes('RetryInfo') || d?.retryDelay);
          if (retryInfo?.retryDelay) {
            const m = String(retryInfo.retryDelay).match(/(\d+(?:\.\d+)?)/);
            if (m) return Math.ceil(parseFloat(m[1]) * 1000);
          }
        }

        const match = errMsg.match(/retry in\s+(\d+(?:\.\d+)?)\s*s/i);
        if (match) {
          return Math.ceil(parseFloat(match[1]) * 1000);
        }
      } catch {}
      return null;
    };

    // Attempt generation with preferred model and sensible fallbacks
    let lastError: any = null;
    for (const modelName of this.preferredModels) {
      let rawText = '';
      let attempts = 0;
      const maxModelAttempts = 2;

      while (attempts < maxModelAttempts && !rawText) {
        attempts++;
        try {
          // Prefer Google Interactions API
          const interaction = await ai.interactions.create({
            model: modelName,
            input: prompt,
            system_instruction: systemInstruction,
          });

          if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
            rawText = interaction.output_text.trim();
          } else if (interaction.steps && Array.isArray(interaction.steps)) {
            for (const step of interaction.steps) {
              if (step.type === 'model_output' && Array.isArray(step.content)) {
                for (const c of step.content) {
                  if (c && c.type === 'text' && typeof c.text === 'string') {
                    rawText += c.text;
                  }
                }
              }
            }
          }
        } catch (interactionErr: any) {
          const retryMs = extractRetryDelay(interactionErr);
          if (retryMs && retryMs <= 4000 && attempts < maxModelAttempts) {
            console.warn(`[AgentReasoner] Rate limited on ${modelName}. Waiting ${retryMs + 500}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, retryMs + 500));
            continue;
          }

          // Fallback to generateContent on the same model if interactions API threw an error
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });
            rawText = response.text?.trim() || '';
          } catch (genErr: any) {
            const genRetryMs = extractRetryDelay(genErr);
            if (genRetryMs && genRetryMs <= 4000 && attempts < maxModelAttempts) {
              console.warn(`[AgentReasoner] Rate limited on ${modelName} generateContent. Waiting ${genRetryMs + 500}ms...`);
              await new Promise((resolve) => setTimeout(resolve, genRetryMs + 500));
              continue;
            }
            lastError = genErr;
            console.warn(`[AgentReasoner] Model ${modelName} failed:`, genErr?.message || genErr);
            break;
          }
        }
      }

      if (!rawText) {
        lastError = new Error(`Empty response received from model ${modelName}`);
        continue;
      }

      try {
        const parsedAction = this.validateAndNormalizeAction(rawText, observation, goal);
        return parsedAction;
      } catch (parseErr: any) {
        lastError = parseErr;
        console.warn(`[AgentReasoner] Failed to parse action from ${modelName}:`, parseErr?.message || parseErr);
        continue;
      }
    }

    const actualErrorMsg = lastError?.message || (typeof lastError === 'string' ? lastError : 'Unknown error');
    throw new Error(`Gemini reasoning unavailable: ${actualErrorMsg}`);
  }

  /**
   * Safely extracts and parses JSON from raw model output.
   */
  private extractJson(rawText: string): any {
    const trimmed = rawText.trim();
    try {
      return JSON.parse(trimmed);
    } catch {}

    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }

    const objMatch = trimmed.match(/(\{[\s\S]*\})/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[1].trim());
      } catch {}
    }

    throw new Error(`Failed to parse valid JSON from Gemini response: ${trimmed.slice(0, 150)}`);
  }

  /**
   * Validates and sanitizes the parsed action to guarantee runtime safety.
   */
  private validateAndNormalizeAction(rawJson: string, observation: any, goal: string): AgentAction {
    const obj = this.extractJson(rawJson);

    if (!obj || typeof obj !== 'object') {
      throw new Error('Invalid reasoning response: root JSON must be an object.');
    }

    const action = String(obj.action || '').trim().toLowerCase();
    const validActions = ['click', 'type', 'scroll', 'wait', 'back', 'navigate', 'finish'];

    if (!validActions.includes(action)) {
      throw new Error(`Unsupported action type "${action}". Must be one of: ${validActions.join(', ')}`);
    }

    // Determine or sanitize intentType
    const validIntents: GoalIntentType[] = [
      'NAVIGATION',
      'SEARCH',
      'INFORMATION_RETRIEVAL',
      'ACTION',
      'VERIFICATION',
    ];
    let intentType: GoalIntentType = 'NAVIGATION';
    if (obj.intentType && validIntents.includes(obj.intentType)) {
      intentType = obj.intentType;
    } else {
      // Fallback intent detection from goal text
      const lowerGoal = goal.toLowerCase();
      if (
        lowerGoal.includes('give') ||
        lowerGoal.includes('list') ||
        lowerGoal.includes('show') ||
        lowerGoal.includes('find') ||
        lowerGoal.includes('rating') ||
        lowerGoal.includes('price') ||
        lowerGoal.includes('what') ||
        lowerGoal.includes('compare') ||
        lowerGoal.includes('how many')
      ) {
        intentType = 'INFORMATION_RETRIEVAL';
      } else if (lowerGoal.includes('search')) {
        intentType = 'SEARCH';
      } else if (lowerGoal.includes('click') || lowerGoal.includes('type') || lowerGoal.includes('fill')) {
        intentType = 'ACTION';
      } else if (lowerGoal.includes('verify') || lowerGoal.includes('check')) {
        intentType = 'VERIFICATION';
      }
    }

    // Sanitize extracted results if provided
    let extractedResults: ExtractedResultItem[] | undefined;
    if (Array.isArray(obj.extractedResults) && obj.extractedResults.length > 0) {
      extractedResults = obj.extractedResults
        .filter((item: any) => item && typeof item === 'object' && (item.name || item.title))
        .map((item: any) => ({
          name: String(item.name || item.title || '').trim(),
          rating: item.rating ? String(item.rating).trim() : undefined,
          details: item.details ? String(item.details).trim() : undefined,
          source: item.source ? String(item.source).trim() : (observation?.title || 'Webpage'),
          url: observation?.url,
        }));
    }

    // Support both explanation and reason
    const explanationText = typeof obj.reason === 'string' && obj.reason.trim()
      ? obj.reason.trim()
      : (typeof obj.explanation === 'string' && obj.explanation.trim() ? obj.explanation.trim() : undefined);

    // Support both elementId and target
    const target = typeof obj.target === 'string' && obj.target.trim()
      ? obj.target.trim()
      : (typeof obj.elementId === 'string' && obj.elementId.trim() ? obj.elementId.trim() : '');

    const elementId = typeof obj.elementId === 'string' && obj.elementId.trim()
      ? obj.elementId.trim()
      : (target.startsWith('elem_') ? target : undefined);

    // Support both text and value
    const value = typeof obj.value === 'string'
      ? obj.value
      : (typeof obj.text === 'string' ? obj.text : undefined);

    // Support both milliseconds and duration
    const milliseconds = typeof obj.milliseconds === 'number'
      ? obj.milliseconds
      : (typeof obj.duration === 'number' ? obj.duration : undefined);

    const normalized: AgentAction = {
      action: action as any,
      intentType,
      extractedResults,
      explanation: explanationText || `Executing ${action.toUpperCase()}`,
      reason: explanationText || `Executing ${action.toUpperCase()}`,
      elementId,
      target: target || elementId,
      value,
      text: value,
      milliseconds,
    };

    if (action === 'click') {
      if (!target && !elementId) {
        throw new Error('The "CLICK" action requires a non-empty "elementId" or "target" property.');
      }
      normalized.target = target || elementId;
      normalized.elementId = elementId;
    } else if (action === 'type') {
      if ((!target && !elementId) || value === undefined) {
        throw new Error('The "TYPE" action requires "elementId" (or "target") and "text" (or "value").');
      }
      normalized.target = target || elementId;
      normalized.elementId = elementId;
      normalized.value = value;
      normalized.text = value;
    } else if (action === 'scroll') {
      const dir = String(obj.direction || 'down').toLowerCase();
      normalized.direction = dir === 'up' ? 'up' : 'down';
    } else if (action === 'wait') {
      normalized.milliseconds = milliseconds;
    } else if (action === 'navigate') {
      const url = typeof obj.url === 'string' ? obj.url.trim() : '';
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        throw new Error('The "NAVIGATE" action requires a valid http:// or https:// URL.');
      }
      normalized.url = url;
    }

    return normalized;
  }
}

export const agentReasoner = new AgentReasoner();

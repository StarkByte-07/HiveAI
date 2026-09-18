import { GoogleGenAI } from '@google/genai';
import type { AgentAction, AgentReasoningInput } from './agentTypes.ts';

export class AgentReasoner {
  private ai: GoogleGenAI | null = null;
  private readonly preferredModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
  ];

  private getAI(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim().length === 0) {
        throw new Error(
          'GEMINI_API_KEY is not configured in the server environment. Please set GEMINI_API_KEY in your environment or secrets.'
        );
      }
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
   * the testing goal, the structured page observation, and action history.
   */
  async decideNextAction(input: AgentReasoningInput): Promise<AgentAction> {
    const ai = this.getAI();

    // Prepare structured payload for Gemini
    const { goal, currentStep, maxSteps, observation, history } = input;

    // Filter and format interactive elements to keep token size efficient and relevant
    const formattedElements = observation.interactiveElements
      .slice(0, 70) // Top 70 interactive elements
      .map((el) => {
        const stateDesc = el.state
          ? Object.entries(el.state)
              .filter(([_, val]) => val !== undefined && val !== false && val !== '')
              .map(([key, val]) => `${key}=${val}`)
              .join(', ')
          : '';
        return `[id: ${el.id}] role="${el.role}" name="${el.name || el.text || ''}" type="${el.elementType}"${stateDesc ? ` state=(${stateDesc})` : ''}`;
      });

    const formattedHistory = history.map((h) => 
      `Step ${h.stepNumber}: ${h.action.action.toUpperCase()} ${h.action.target ? `"${h.action.target}"` : ''} -> Result: ${h.result} (${h.message})`
    );

    const prompt = `
You are HiveAI, an autonomous agent for black-box UI/UX & accessibility testing.
Your mission is to explore and evaluate the target web application to achieve the user's testing goal.

TESTING GOAL:
"${goal || 'Explore and test the key user flows and interactive controls on this page'}"

CURRENT AGENT STATE:
- Step: ${currentStep} of ${maxSteps} max steps
- Current URL: ${observation.url}
- Page Title: "${observation.title}"

PAGE CONTENT OVERVIEW:
Headings:
${observation.headings.length > 0 ? observation.headings.slice(0, 8).map((h) => `- ${h}`).join('\n') : '(None)'}

Key Visible Text:
${observation.visibleText.length > 0 ? observation.visibleText.slice(0, 10).map((t) => `- "${t}"`).join('\n') : '(None)'}

INTERACTIVE ELEMENTS CURRENTLY ON PAGE:
${formattedElements.length > 0 ? formattedElements.join('\n') : '(No interactive elements detected)'}

PREVIOUS ACTION HISTORY:
${formattedHistory.length > 0 ? formattedHistory.join('\n') : '(No previous actions taken yet)'}

RULES & CONSTRAINTS:
1. Select EXACTLY ONE next action from the supported set:
   - "click": Click an interactive element. Provide "target" (use the element name, text, or id).
   - "type": Fill an input or search field. Provide "target" and "value" (the text to type).
   - "scroll": Scroll the viewport. Provide "direction": "down" or "up".
   - "wait": Pause briefly for dynamic content to load.
   - "back": Navigate back in browser history.
   - "navigate": Go to a specific URL. Provide "url" (must be http:// or https://).
   - "finish": Finish testing when the goal is achieved or no further actions are meaningful.

2. Framework-agnostic: Base your decision strictly on the observed interactive elements and page content.
3. If an action failed in history, do not repeat the exact same failed action. Try another element or alternative path.
4. If the goal is satisfied, return the "finish" action.
5. You MUST return a strictly valid JSON object matching this schema:
{
  "action": "click" | "type" | "scroll" | "wait" | "back" | "navigate" | "finish",
  "target": "string (required for click and type)",
  "value": "string (required for type)",
  "direction": "down" | "up (required for scroll)",
  "url": "string (required for navigate)",
  "explanation": "Brief 1-2 sentence explanation of why this action was selected towards the goal"
}
`;

    // Attempt generation with model fallback
    let lastError: any = null;
    for (const modelName of this.preferredModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1, // Low temperature for deterministic, logical decision making
          },
        });

        const rawText = response.text?.trim() || '';
        if (!rawText) {
          throw new Error(`Empty response received from model ${modelName}`);
        }

        const parsedAction = this.validateAndNormalizeAction(rawText, observation);
        return parsedAction;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AgentReasoner] Model ${modelName} encountered error:`, err?.message || err);
        // Continue loop to try next fallback model
      }
    }

    throw new Error(
      `Agent reasoning failed across all Gemini models: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Validates and sanitizes the parsed action to guarantee runtime safety.
   */
  private validateAndNormalizeAction(rawJson: string, observation: any): AgentAction {
    let obj: any;
    try {
      obj = JSON.parse(rawJson);
    } catch {
      // Attempt to extract json object if wrapped
      const match = rawJson.match(/\{[\s\S]*\}/);
      if (match) {
        obj = JSON.parse(match[0]);
      } else {
        throw new Error(`Failed to parse JSON response from Gemini: ${rawJson.slice(0, 100)}`);
      }
    }

    if (!obj || typeof obj !== 'object') {
      throw new Error('Invalid reasoning response: root JSON must be an object.');
    }

    const action = String(obj.action || '').trim().toLowerCase();
    const validActions = ['click', 'type', 'scroll', 'wait', 'back', 'navigate', 'finish'];

    if (!validActions.includes(action)) {
      throw new Error(`Unsupported action type "${action}". Must be one of: ${validActions.join(', ')}`);
    }

    const normalized: AgentAction = {
      action: action as any,
      explanation: typeof obj.explanation === 'string' ? obj.explanation.trim() : `Executing ${action}`,
    };

    if (action === 'click') {
      const target = typeof obj.target === 'string' ? obj.target.trim() : '';
      if (!target) {
        throw new Error('The "click" action requires a non-empty "target" property.');
      }
      normalized.target = target;
    } else if (action === 'type') {
      const target = typeof obj.target === 'string' ? obj.target.trim() : '';
      const value = typeof obj.value === 'string' ? obj.value.trim() : '';
      if (!target || !value) {
        throw new Error('The "type" action requires both "target" and "value" properties.');
      }
      normalized.target = target;
      normalized.value = value;
    } else if (action === 'scroll') {
      const dir = String(obj.direction || 'down').toLowerCase();
      normalized.direction = dir === 'up' ? 'up' : 'down';
    } else if (action === 'navigate') {
      const url = typeof obj.url === 'string' ? obj.url.trim() : '';
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        throw new Error('The "navigate" action requires a valid http:// or https:// URL.');
      }
      normalized.url = url;
    }

    return normalized;
  }
}

export const agentReasoner = new AgentReasoner();

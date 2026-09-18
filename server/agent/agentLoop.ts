import { browserManager } from '../browser/browserManager.ts';
import { observationEngine } from '../observation/observationEngine.ts';
import type { PageObservation } from '../observation/observationTypes.ts';
import { agentReasoner } from './agentReasoner.ts';
import { agentExecutor } from './agentExecutor.ts';
import { accessibilityAuditor, type AccessibilityAuditResult } from '../audit/accessibilityAuditor.ts';
import { perfTimer } from '../utils/timing.ts';
import type {
  AgentAction,
  AgentHistoryItem,
  AgentStepEvent,
  AgentLoopConfig,
  AgentLoopResult,
  GoalIntentType,
  ExtractedResultItem,
} from './agentTypes.ts';

export class AgentLoop {
  private isRunning: boolean = false;
  private abortRequested: boolean = false;
  private currentLoopId: string | null = null;

  /**
   * Request stopping the currently active agent loop.
   */
  abort(): void {
    if (this.isRunning) {
      this.abortRequested = true;
    }
  }

  isLoopRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Runs the complete autonomous Observe -> Reason -> Act -> Re-Observe loop.
   */
  async run(
    targetUrl: string,
    goal: string,
    config: AgentLoopConfig = {}
  ): Promise<AgentLoopResult> {
    if (this.isRunning) {
      throw new Error('An agent session is already running. Please wait for it to finish or abort it.');
    }

    this.isRunning = true;
    this.abortRequested = false;
    const loopId = Date.now().toString();
    this.currentLoopId = loopId;
    perfTimer.start('task_total');

    const maxSteps = Math.min(Math.max(config.maxSteps || 15, 3), 30);
    const journey: AgentStepEvent[] = [];
    const history: AgentHistoryItem[] = [];
    const cumulativeResults: ExtractedResultItem[] = [];
    let detectedIntent: GoalIntentType = 'NAVIGATION';
    let currentStepNumber = 1;
    let latestObservation: PageObservation | null = null;

    const emitEvent = (event: AgentStepEvent) => {
      journey.push(event);
      if (config.onEvent) {
        try {
          config.onEvent(event);
        } catch (err) {
          console.error('[AgentLoop] Error in onEvent callback:', err);
        }
      }
    };

    try {
      // ==========================================
      // STEP 1: NAVIGATE to Target URL
      // ==========================================
      const navTimestamp = new Date().toLocaleTimeString();
      const navResult = await browserManager.launchAndNavigate(targetUrl);
      
      const navEvent: AgentStepEvent = {
        stepNumber: currentStepNumber++,
        type: 'NAVIGATE',
        status: 'success',
        description: `Browser navigated to target page: "${navResult.title}"`,
        url: navResult.url,
        timestamp: navTimestamp,
      };
      emitEvent(navEvent);

      if (this.abortRequested) {
        return this.finishResult(goal, journey, latestObservation, 'STOPPED', 'Agent stopped by user.');
      }

      // ==========================================
      // STEP 2: INITIAL OBSERVE
      // ==========================================
      const page = browserManager.getPage();
      if (!page) {
        throw new Error('Browser page unavailable after navigation.');
      }

      latestObservation = await observationEngine.observePage(page);
      const obsTimestamp = latestObservation.timestamp;

      const initialObsEvent: AgentStepEvent = {
        stepNumber: currentStepNumber++,
        type: 'OBSERVE',
        status: 'success',
        description: `Observed page: ${latestObservation.stats.totalInteractiveCount} interactive elements, ${latestObservation.visibleText.length} text blocks, captured live screenshot`,
        url: latestObservation.url,
        timestamp: obsTimestamp,
        observation: latestObservation,
      };
      emitEvent(initialObsEvent);

      // STEP 7: Check early if page is blocked by anti-bot/CAPTCHA/403
      if (latestObservation.isBlocked || navResult.statusCode === 403 || navResult.statusCode === 401) {
        const blockedMsg = latestObservation.blockedReason || `Target page returned HTTP ${navResult.statusCode} Access Denied / Anti-bot verification.`;
        emitEvent({
          stepNumber: currentStepNumber++,
          type: 'ERROR',
          status: 'failed',
          description: blockedMsg,
          url: latestObservation.url,
          timestamp: new Date().toLocaleTimeString(),
          isTerminal: true,
        });
        return this.finishResult(goal, journey, latestObservation, 'FAILED', blockedMsg, blockedMsg, detectedIntent, cumulativeResults);
      }

      // ==========================================
      // AGENTIC AUTONOMOUS LOOP
      // ==========================================
      while (currentStepNumber <= maxSteps && !this.abortRequested) {
        perfTimer.start('step_total');

        // --- 1. REASONING PHASE ---
        const reasonStepNumber = currentStepNumber++;
        const reasonTimestamp = new Date().toLocaleTimeString();

        // Emit starting reasoning event
        emitEvent({
          stepNumber: reasonStepNumber,
          type: 'REASON',
          status: 'running',
          description: 'Gemini is evaluating goal and current page observation...',
          timestamp: reasonTimestamp,
        });

        let nextAction: AgentAction;
        try {
          nextAction = await agentReasoner.decideNextAction({
            goal,
            currentStep: reasonStepNumber,
            maxSteps,
            observation: latestObservation,
            history,
            cumulativeResults,
            intentType: detectedIntent,
          });
        } catch (reasonErr: any) {
          perfTimer.end('step_total');
          const rawError = reasonErr?.message || 'Reasoning error';
          const errorMsg = rawError.startsWith('Gemini reasoning unavailable')
            ? rawError
            : `Agent reasoning failed: ${rawError}`;
          emitEvent({
            stepNumber: currentStepNumber++,
            type: 'ERROR',
            status: 'failed',
            description: errorMsg,
            timestamp: new Date().toLocaleTimeString(),
            isTerminal: true,
          });
          return this.finishResult(goal, journey, latestObservation, 'FAILED', errorMsg, errorMsg, detectedIntent, cumulativeResults);
        }

        if (nextAction.intentType) {
          detectedIntent = nextAction.intentType;
        }

        if (nextAction.extractedResults && nextAction.extractedResults.length > 0) {
          for (const item of nextAction.extractedResults) {
            const key = item.name.toLowerCase().trim();
            if (!cumulativeResults.some((r) => r.name.toLowerCase().trim() === key)) {
              cumulativeResults.push(item);
            }
          }
        }

        // Emit completed reasoning event with chosen action details
        const actionDisplay = nextAction.action.toUpperCase();
        const targetDisplay = nextAction.target ? ` "${nextAction.target}"` : '';
        const valueDisplay = nextAction.value ? ` with value "${nextAction.value}"` : '';
        const dirDisplay = nextAction.direction ? ` (${nextAction.direction})` : '';

        emitEvent({
          stepNumber: reasonStepNumber,
          type: 'REASON',
          status: 'success',
          action: nextAction,
          actionType: nextAction.action,
          target: nextAction.target,
          explanation: nextAction.explanation,
          intentType: detectedIntent,
          extractedResults: cumulativeResults.length > 0 ? [...cumulativeResults] : undefined,
          description: `Selected: ${actionDisplay}${targetDisplay}${valueDisplay}${dirDisplay}. Reasoning: ${nextAction.explanation || 'Moving toward goal.'}`,
          timestamp: new Date().toLocaleTimeString(),
        });

        if (this.abortRequested) {
          perfTimer.end('step_total');
          return this.finishResult(goal, journey, latestObservation, 'STOPPED', 'Agent stopped by user.', undefined, detectedIntent, cumulativeResults);
        }

        // --- Check for FINISH action ---
        if (nextAction.action === 'finish') {
          perfTimer.end('step_total');
          const candidateResults = nextAction.extractedResults && nextAction.extractedResults.length > 0
            ? nextAction.extractedResults
            : cumulativeResults;

          const validation = this.validateGoalFulfillment(
            goal,
            detectedIntent,
            candidateResults,
            latestObservation,
            nextAction.explanation
          );

          // Run final black-box accessibility audit on active target page
          let finalAudit: AccessibilityAuditResult | undefined;
          try {
            if (page && !page.isClosed()) {
              finalAudit = await accessibilityAuditor.auditPage(page, latestObservation);
            }
          } catch (auditErr: any) {
            console.warn('[AgentLoop] Final accessibility audit warning:', auditErr?.message);
          }

          const finishEvent: AgentStepEvent = {
            stepNumber: currentStepNumber++,
            type: 'FINISH',
            status: validation.status === 'COMPLETED' ? 'success' : 'failed',
            action: nextAction,
            actionType: 'finish',
            intentType: detectedIntent,
            extractedResults: validation.filteredResults || candidateResults,
            accessibilityAudit: finalAudit,
            description: validation.status === 'COMPLETED'
              ? `Goal completed: ${validation.reason}`
              : `Goal unfulfilled: ${validation.reason}`,
            explanation: validation.reason,
            url: page.url(),
            timestamp: new Date().toLocaleTimeString(),
            isTerminal: true,
          };
          emitEvent(finishEvent);

          return this.finishResult(
            goal,
            journey,
            latestObservation,
            validation.status,
            finishEvent.description,
            validation.status === 'FAILED' ? validation.reason : undefined,
            detectedIntent,
            validation.filteredResults || candidateResults,
            finalAudit
          );
        }

        // --- 2. EXECUTION PHASE ---
        const actionStepNumber = currentStepNumber++;
        const actionTimestamp = new Date().toLocaleTimeString();

        emitEvent({
          stepNumber: actionStepNumber,
          type: 'ACTION',
          status: 'running',
          action: nextAction,
          actionType: nextAction.action,
          target: nextAction.target,
          explanation: nextAction.explanation,
          description: `Executing action: ${actionDisplay}${targetDisplay}...`,
          timestamp: actionTimestamp,
        });

        const urlBefore = page.url();
        const execResult = await agentExecutor.executeAction(page, nextAction, latestObservation);

        // Record into history
        history.push({
          stepNumber: actionStepNumber,
          action: nextAction,
          result: execResult.success ? 'success' : 'failed',
          message: execResult.message,
          urlAfterAction: execResult.currentUrl,
        });

        emitEvent({
          stepNumber: actionStepNumber,
          type: 'ACTION',
          status: execResult.success ? 'success' : 'failed',
          action: nextAction,
          actionType: nextAction.action,
          target: nextAction.target,
          explanation: nextAction.explanation,
          description: execResult.message,
          result: {
            success: execResult.success,
            message: execResult.message,
          },
          url: execResult.currentUrl || page.url(),
          timestamp: new Date().toLocaleTimeString(),
        });

        if (this.abortRequested) {
          perfTimer.end('step_total');
          return this.finishResult(goal, journey, latestObservation, 'STOPPED', 'Agent stopped by user.', undefined, detectedIntent, cumulativeResults);
        }

        // --- 3. RE-OBSERVATION PHASE ---
        const reobsStepNumber = currentStepNumber++;
        emitEvent({
          stepNumber: reobsStepNumber,
          type: 'OBSERVE',
          status: 'running',
          url: page.url(),
          description: 'Re-observing page state following action execution...',
          timestamp: new Date().toLocaleTimeString(),
        });

        try {
          latestObservation = await observationEngine.observePage(page);
          emitEvent({
            stepNumber: reobsStepNumber,
            type: 'OBSERVE',
            status: 'success',
            description: `Re-observed page: ${latestObservation.stats.totalInteractiveCount} interactive elements, ${latestObservation.visibleText.length} text blocks, updated screenshot`,
            url: latestObservation.url,
            timestamp: latestObservation.timestamp,
            observation: latestObservation,
          });

          // Post-action state validation feedback into agent history
          const urlChanged = latestObservation.url !== urlBefore;
          const stateValidationMessage = latestObservation.isBlocked
            ? 'Post-action state: Page is blocked by CAPTCHA / bot challenge.'
            : urlChanged
              ? `Post-action state: Navigated to "${latestObservation.title || latestObservation.url}".`
              : `Post-action state: Same page, active controls: ${latestObservation.stats.totalInteractiveCount}.`;

          if (history.length > 0) {
            history[history.length - 1].message += ` [${stateValidationMessage}]`;
          }

          // If the page is blocked by CAPTCHA / bot challenge, stop cleanly immediately
          if (latestObservation.isBlocked) {
            const blockedMsg = latestObservation.blockedReason || 'Target page encountered an anti-bot or CAPTCHA block after action.';
            emitEvent({
              stepNumber: currentStepNumber++,
              type: 'ERROR',
              status: 'failed',
              description: blockedMsg,
              url: latestObservation.url,
              timestamp: new Date().toLocaleTimeString(),
              isTerminal: true,
            });
            perfTimer.end('step_total');
            return this.finishResult(goal, journey, latestObservation, 'FAILED', blockedMsg, blockedMsg, detectedIntent, cumulativeResults);
          }
        } catch (obsErr: any) {
          console.warn('[AgentLoop] Re-observation warning:', obsErr?.message);
        }

        perfTimer.end('step_total');
      }

      // If loop exited due to step limit
      if (currentStepNumber > maxSteps) {
        let finalAudit: AccessibilityAuditResult | undefined;
        try {
          const page = browserManager.getPage();
          if (page && !page.isClosed()) {
            finalAudit = await accessibilityAuditor.auditPage(page, latestObservation);
          }
        } catch (auditErr: any) {
          console.warn('[AgentLoop] Final accessibility audit warning:', auditErr?.message);
        }

        const limitDescription = `Maximum step limit reached (${maxSteps} steps). The testing goal could not be fully verified within the step limit.`;
        const limitEvent: AgentStepEvent = {
          stepNumber: currentStepNumber++,
          type: 'FINISH',
          status: 'failed',
          intentType: detectedIntent,
          extractedResults: cumulativeResults.length > 0 ? [...cumulativeResults] : undefined,
          accessibilityAudit: finalAudit,
          description: limitDescription,
          explanation: limitDescription,
          timestamp: new Date().toLocaleTimeString(),
          isTerminal: true,
        };
        emitEvent(limitEvent);
        return this.finishResult(
          goal,
          journey,
          latestObservation,
          'MAX_STEPS_REACHED',
          limitDescription,
          limitDescription,
          detectedIntent,
          cumulativeResults,
          finalAudit
        );
      }

      return this.finishResult(goal, journey, latestObservation, 'COMPLETED', 'Agent loop finished.', undefined, detectedIntent, cumulativeResults);
    } catch (fatalErr: any) {
      console.error('[AgentLoop] Fatal error:', fatalErr);
      const errorMsg = fatalErr?.message || 'Unknown agent execution error';
      emitEvent({
        stepNumber: currentStepNumber++,
        type: 'ERROR',
        status: 'failed',
        description: `Agent fatal error: ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString(),
        isTerminal: true,
      });
      return this.finishResult(goal, journey, latestObservation, 'FAILED', errorMsg, errorMsg, detectedIntent, cumulativeResults);
    } finally {
      this.isRunning = false;
      this.currentLoopId = null;
      perfTimer.end('task_total');
    }
  }

  /**
   * Validates if the observed browser state genuinely fulfills the goal.
   * Prevents premature or hallucinated "completion" claims.
   */
  private validateGoalFulfillment(
    goal: string,
    intent: GoalIntentType,
    cumulativeResults: ExtractedResultItem[],
    observation: PageObservation | null,
    explanation?: string
  ): { isValid: boolean; status: 'COMPLETED' | 'FAILED'; reason: string; filteredResults?: ExtractedResultItem[] } {
    const explLower = (explanation || '').toLowerCase();

    // 1. Blocked page check
    if (observation?.isBlocked) {
      return {
        isValid: false,
        status: 'FAILED',
        reason: `Target page is blocked: ${observation.blockedReason || 'Anti-bot or CAPTCHA verification detected.'}`,
      };
    }

    // 2. Failure phrases check in Gemini's explanation
    const failurePhrases = [
      'does not display the requested',
      'unable to find',
      'could not find',
      'cannot find',
      'no results found',
      'not available on this page',
      'failed to locate',
      'failed to retrieve',
    ];
    if (failurePhrases.some((p) => explLower.includes(p))) {
      return {
        isValid: false,
        status: 'FAILED',
        reason: explanation || 'Unable to satisfy the goal: the requested content was not found on the page.',
      };
    }

    // 3. INFORMATION_RETRIEVAL validation
    if (intent === 'INFORMATION_RETRIEVAL') {
      if (!cumulativeResults || cumulativeResults.length === 0) {
        return {
          isValid: false,
          status: 'FAILED',
          reason: 'Information retrieval goal unfulfilled: No structured items or ratings were extracted from the application.',
        };
      }

      // Filter valid items with actual names
      const validItems = cumulativeResults.filter((item) => item.name && item.name.trim().length > 0);
      if (validItems.length === 0) {
        return {
          isValid: false,
          status: 'FAILED',
          reason: 'Information retrieval goal unfulfilled: Extracted items were missing valid names or details.',
        };
      }

      // Deduplicate results
      const deduplicated: ExtractedResultItem[] = [];
      const seen = new Set<string>();
      for (const item of validItems) {
        const key = item.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          deduplicated.push(item);
        }
      }

      return {
        isValid: true,
        status: 'COMPLETED',
        reason: explanation || `Successfully retrieved ${deduplicated.length} items satisfying the testing goal.`,
        filteredResults: deduplicated,
      };
    }

    // 4. Default completion for other verified intents
    return {
      isValid: true,
      status: 'COMPLETED',
      reason: explanation || 'Testing goal successfully fulfilled.',
    };
  }

  private finishResult(
    goal: string,
    journey: AgentStepEvent[],
    finalObservation: PageObservation | null,
    status: 'COMPLETED' | 'MAX_STEPS_REACHED' | 'FAILED' | 'STOPPED',
    message: string,
    error?: string,
    intentType?: GoalIntentType,
    extractedResults?: ExtractedResultItem[],
    accessibilityAudit?: AccessibilityAuditResult
  ): AgentLoopResult {
    return {
      success: status === 'COMPLETED',
      status,
      goal,
      intentType,
      extractedResults,
      accessibilityAudit,
      totalSteps: journey.length,
      journey,
      finalObservation,
      message,
      error,
    };
  }
}

export const agentLoop = new AgentLoop();

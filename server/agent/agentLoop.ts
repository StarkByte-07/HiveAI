import { browserManager } from '../browser/browserManager.ts';
import { observationEngine } from '../observation/observationEngine.ts';
import type { PageObservation } from '../observation/observationTypes.ts';
import { agentReasoner } from './agentReasoner.ts';
import { agentExecutor } from './agentExecutor.ts';
import { goalValidator } from './goalValidator.ts';
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
   * Runs the complete autonomous lifecycle:
   * OBSERVE -> REASON -> ACTION -> EXECUTE ACTION -> OBSERVE RESULT -> VALIDATE GOAL
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

      // Check early if page is blocked by anti-bot/CAPTCHA/403
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
        return this.finishResult(goal, journey, latestObservation, 'BLOCKED', blockedMsg, blockedMsg, detectedIntent, cumulativeResults);
      }

      // Check if target page observation alone validates a simple navigation goal (TEST 4)
      const initialValidation = goalValidator.validateGoal(
        goal,
        detectedIntent,
        cumulativeResults,
        latestObservation,
        history
      );

      if (initialValidation.isSatisfied) {
        let finalAudit: AccessibilityAuditResult | undefined;
        try {
          if (page && !page.isClosed()) {
            finalAudit = await accessibilityAuditor.auditPage(page, latestObservation);
          }
        } catch (auditErr: any) {
          console.warn('[AgentLoop] Accessibility audit warning:', auditErr?.message);
        }

        const finishEvent: AgentStepEvent = {
          stepNumber: currentStepNumber++,
          type: 'FINISH',
          status: 'success',
          actionType: 'finish',
          intentType: detectedIntent,
          accessibilityAudit: finalAudit,
          description: `Goal validated and completed: ${initialValidation.reason}`,
          explanation: initialValidation.reason,
          url: page.url(),
          timestamp: new Date().toLocaleTimeString(),
          isTerminal: true,
        };
        emitEvent(finishEvent);

        return this.finishResult(
          goal,
          journey,
          latestObservation,
          'COMPLETED',
          finishEvent.description,
          undefined,
          detectedIntent,
          cumulativeResults,
          finalAudit
        );
      }

      // ==========================================
      // AGENTIC AUTONOMOUS LOOP
      // OBSERVE -> REASON -> ACTION -> EXECUTE -> OBSERVE -> VALIDATE
      // ==========================================
      while (currentStepNumber <= maxSteps && !this.abortRequested) {
        perfTimer.start('step_total');

        // --- 1. REASONING PHASE ---
        const reasonStepNumber = currentStepNumber++;
        const reasonTimestamp = new Date().toLocaleTimeString();

        emitEvent({
          stepNumber: reasonStepNumber,
          type: 'REASON',
          status: 'running',
          description: 'Gemini is evaluating goal constraints and current page observation...',
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

        // Accumulate extracted candidates
        if (nextAction.extractedResults && nextAction.extractedResults.length > 0) {
          for (const item of nextAction.extractedResults) {
            const key = item.name.toLowerCase().trim();
            if (!cumulativeResults.some((r) => r.name.toLowerCase().trim() === key)) {
              cumulativeResults.push(item);
            }
          }
        }

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

        // --- Check for FINISH action requested by Gemini ---
        if (nextAction.action === 'finish') {
          perfTimer.end('step_total');
          const candidateResults = nextAction.extractedResults && nextAction.extractedResults.length > 0
            ? nextAction.extractedResults
            : cumulativeResults;

          // Rigorous Goal Validation check against constraints and browser evidence
          const validation = goalValidator.validateGoal(
            goal,
            detectedIntent,
            candidateResults,
            latestObservation,
            history,
            nextAction.explanation
          );

          if (validation.isSatisfied) {
            // Positively validated completion!
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
              status: 'success',
              action: nextAction,
              actionType: 'finish',
              intentType: detectedIntent,
              extractedResults: validation.validatedResults,
              accessibilityAudit: finalAudit,
              description: `Goal completed: ${validation.reason}`,
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
              'COMPLETED',
              finishEvent.description,
              undefined,
              detectedIntent,
              validation.validatedResults,
              finalAudit,
              validation.rejectedResults,
              validation.unmetConstraints
            );
          } else {
            // Goal NOT satisfied!
            // If steps remain, REJECT the premature finish and continue exploring.
            if (currentStepNumber < maxSteps) {
              const rejectStepNumber = currentStepNumber++;
              const rejectionMsg = `Goal validation rejected premature finish: ${validation.reason}`;
              emitEvent({
                stepNumber: rejectStepNumber,
                type: 'VALIDATE',
                status: 'failed',
                description: rejectionMsg,
                explanation: validation.reason,
                rejectedResults: validation.rejectedResults,
                unmetConstraints: validation.unmetConstraints,
                url: page.url(),
                timestamp: new Date().toLocaleTimeString(),
              });

              history.push({
                stepNumber: rejectStepNumber,
                action: nextAction,
                result: 'failed',
                message: `Premature FINISH rejected: ${validation.reason}. You must continue taking actions (clicking relevant links, navigating, or verifying items) to satisfy the goal.`,
                urlAfterAction: page.url(),
              });

              // Continue the loop to take the next useful action
              continue;
            } else {
              // Max steps exhausted without goal satisfaction -> terminate as FAILED
              let finalAudit: AccessibilityAuditResult | undefined;
              try {
                if (page && !page.isClosed()) {
                  finalAudit = await accessibilityAuditor.auditPage(page, latestObservation);
                }
              } catch (auditErr: any) {
                console.warn('[AgentLoop] Final accessibility audit warning:', auditErr?.message);
              }

              const failDescription = `Goal could not be fulfilled: ${validation.reason}`;
              const failEvent: AgentStepEvent = {
                stepNumber: currentStepNumber++,
                type: 'FINISH',
                status: 'failed',
                action: nextAction,
                actionType: 'finish',
                intentType: detectedIntent,
                extractedResults: undefined,
                rejectedResults: validation.rejectedResults,
                unmetConstraints: validation.unmetConstraints,
                accessibilityAudit: finalAudit,
                description: failDescription,
                explanation: failDescription,
                url: page.url(),
                timestamp: new Date().toLocaleTimeString(),
                isTerminal: true,
              };
              emitEvent(failEvent);

              return this.finishResult(
                goal,
                journey,
                latestObservation,
                'FAILED',
                failDescription,
                failDescription,
                detectedIntent,
                undefined,
                finalAudit,
                validation.rejectedResults,
                validation.unmetConstraints
              );
            }
          }
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

        // Record action outcome into history
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

          // If the page is blocked by anti-bot challenge, terminate immediately as BLOCKED
          if (latestObservation.isBlocked) {
            const blockedMsg = latestObservation.blockedReason || 'Target page encountered an anti-bot or CAPTCHA block.';
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
            return this.finishResult(goal, journey, latestObservation, 'BLOCKED', blockedMsg, blockedMsg, detectedIntent, cumulativeResults);
          }
        } catch (obsErr: any) {
          console.warn('[AgentLoop] Re-observation warning:', obsErr?.message);
        }

        // --- 4. VALIDATE GOAL PHASE (OBSERVE RESULT -> VALIDATE GOAL) ---
        const validateStepNumber = currentStepNumber++;
        emitEvent({
          stepNumber: validateStepNumber,
          type: 'VALIDATE',
          status: 'running',
          description: 'Validating observed page state and evidence against goal requirements...',
          url: page.url(),
          timestamp: new Date().toLocaleTimeString(),
        });

        const postActionValidation = goalValidator.validateGoal(
          goal,
          detectedIntent,
          cumulativeResults,
          latestObservation,
          history
        );

        if (postActionValidation.isSatisfied) {
          // Goal positively validated from actual browser state!
          let finalAudit: AccessibilityAuditResult | undefined;
          try {
            if (page && !page.isClosed()) {
              finalAudit = await accessibilityAuditor.auditPage(page, latestObservation);
            }
          } catch (auditErr: any) {
            console.warn('[AgentLoop] Final accessibility audit warning:', auditErr?.message);
          }

          emitEvent({
            stepNumber: validateStepNumber,
            type: 'VALIDATE',
            status: 'success',
            description: `Goal validation passed: ${postActionValidation.reason}`,
            explanation: postActionValidation.reason,
            extractedResults: postActionValidation.validatedResults,
            url: page.url(),
            timestamp: new Date().toLocaleTimeString(),
          });

          const finishEvent: AgentStepEvent = {
            stepNumber: currentStepNumber++,
            type: 'FINISH',
            status: 'success',
            actionType: 'finish',
            intentType: detectedIntent,
            extractedResults: postActionValidation.validatedResults,
            accessibilityAudit: finalAudit,
            description: `Goal completed: ${postActionValidation.reason}`,
            explanation: postActionValidation.reason,
            url: page.url(),
            timestamp: new Date().toLocaleTimeString(),
            isTerminal: true,
          };
          emitEvent(finishEvent);
          perfTimer.end('step_total');

          return this.finishResult(
            goal,
            journey,
            latestObservation,
            'COMPLETED',
            finishEvent.description,
            undefined,
            detectedIntent,
            postActionValidation.validatedResults,
            finalAudit,
            postActionValidation.rejectedResults,
            postActionValidation.unmetConstraints
          );
        } else {
          // Validation recorded; continue execution
          emitEvent({
            stepNumber: validateStepNumber,
            type: 'VALIDATE',
            status: 'running',
            description: `Goal validation check: ${postActionValidation.reason}`,
            explanation: postActionValidation.reason,
            rejectedResults: postActionValidation.rejectedResults,
            unmetConstraints: postActionValidation.unmetConstraints,
            url: page.url(),
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        perfTimer.end('step_total');
      }

      // If loop exited due to step limit reached without positive goal validation
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

        const limitDescription = `Maximum execution steps reached (${maxSteps} steps) before the requested goal could be verified.`;
        const limitEvent: AgentStepEvent = {
          stepNumber: currentStepNumber++,
          type: 'FINISH',
          status: 'failed',
          intentType: detectedIntent,
          extractedResults: undefined,
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
          'FAILED',
          limitDescription,
          limitDescription,
          detectedIntent,
          undefined,
          finalAudit
        );
      }

      return this.finishResult(goal, journey, latestObservation, 'FAILED', 'Agent loop stopped without goal verification.', undefined, detectedIntent);
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

  private finishResult(
    goal: string,
    journey: AgentStepEvent[],
    finalObservation: PageObservation | null,
    status: 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'STOPPED' | 'MAX_STEPS_REACHED',
    message: string,
    error?: string,
    intentType?: GoalIntentType,
    extractedResults?: ExtractedResultItem[],
    accessibilityAudit?: AccessibilityAuditResult,
    rejectedResults?: Array<{ item: ExtractedResultItem; reason: string }>,
    unmetConstraints?: string[]
  ): AgentLoopResult {
    const isCompleted = status === 'COMPLETED';
    return {
      success: isCompleted,
      status: status === 'MAX_STEPS_REACHED' ? 'FAILED' : status,
      goalSatisfied: isCompleted,
      goal,
      intentType,
      extractedResults: isCompleted ? extractedResults : undefined,
      rejectedResults,
      unmetConstraints,
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

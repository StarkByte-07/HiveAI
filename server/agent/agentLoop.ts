import { browserManager } from '../browser/browserManager.ts';
import { observationEngine } from '../observation/observationEngine.ts';
import type { PageObservation } from '../observation/observationTypes.ts';
import { agentReasoner } from './agentReasoner.ts';
import { agentExecutor } from './agentExecutor.ts';
import type {
  AgentAction,
  AgentHistoryItem,
  AgentStepEvent,
  AgentLoopConfig,
  AgentLoopResult,
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

    const maxSteps = Math.min(Math.max(config.maxSteps || 15, 3), 30);
    const journey: AgentStepEvent[] = [];
    const history: AgentHistoryItem[] = [];
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

      // ==========================================
      // AGENTIC AUTONOMOUS LOOP
      // ==========================================
      while (currentStepNumber <= maxSteps && !this.abortRequested) {
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
          });
        } catch (reasonErr: any) {
          const errorMsg = reasonErr?.message || 'Reasoning error';
          emitEvent({
            stepNumber: currentStepNumber++,
            type: 'ERROR',
            status: 'failed',
            description: `Agent reasoning failed: ${errorMsg}`,
            timestamp: new Date().toLocaleTimeString(),
            isTerminal: true,
          });
          return this.finishResult(goal, journey, latestObservation, 'FAILED', errorMsg, errorMsg);
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
          description: `Selected: ${actionDisplay}${targetDisplay}${valueDisplay}${dirDisplay}. Reasoning: ${nextAction.explanation || 'Moving toward goal.'}`,
          timestamp: new Date().toLocaleTimeString(),
        });

        if (this.abortRequested) {
          return this.finishResult(goal, journey, latestObservation, 'STOPPED', 'Agent stopped by user.');
        }

        // --- Check for FINISH action ---
        if (nextAction.action === 'finish') {
          const finishEvent: AgentStepEvent = {
            stepNumber: currentStepNumber++,
            type: 'FINISH',
            status: 'success',
            action: nextAction,
            actionType: 'finish',
            description: `Goal completed: ${nextAction.explanation || 'Agent determined the testing goal is fulfilled.'}`,
            explanation: nextAction.explanation,
            url: page.url(),
            timestamp: new Date().toLocaleTimeString(),
            isTerminal: true,
          };
          emitEvent(finishEvent);
          return this.finishResult(goal, journey, latestObservation, 'COMPLETED', finishEvent.description);
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
          url: execResult.currentUrl,
          timestamp: new Date().toLocaleTimeString(),
        });

        if (this.abortRequested) {
          return this.finishResult(goal, journey, latestObservation, 'STOPPED', 'Agent stopped by user.');
        }

        // --- 3. RE-OBSERVATION PHASE ---
        const reobsStepNumber = currentStepNumber++;
        emitEvent({
          stepNumber: reobsStepNumber,
          type: 'OBSERVE',
          status: 'running',
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
        } catch (obsErr: any) {
          console.warn('[AgentLoop] Re-observation warning:', obsErr?.message);
        }
      }

      // If loop exited due to step limit
      if (currentStepNumber > maxSteps) {
        const limitEvent: AgentStepEvent = {
          stepNumber: currentStepNumber++,
          type: 'FINISH',
          status: 'success',
          description: `Maximum step limit reached (${maxSteps} steps). Autonomous execution concluded.`,
          timestamp: new Date().toLocaleTimeString(),
          isTerminal: true,
        };
        emitEvent(limitEvent);
        return this.finishResult(goal, journey, latestObservation, 'MAX_STEPS_REACHED', limitEvent.description);
      }

      return this.finishResult(goal, journey, latestObservation, 'COMPLETED', 'Agent loop finished.');
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
      return this.finishResult(goal, journey, latestObservation, 'FAILED', errorMsg, errorMsg);
    } finally {
      this.isRunning = false;
      this.currentLoopId = null;
    }
  }

  private finishResult(
    goal: string,
    journey: AgentStepEvent[],
    finalObservation: PageObservation | null,
    status: 'COMPLETED' | 'MAX_STEPS_REACHED' | 'FAILED' | 'STOPPED',
    message: string,
    error?: string
  ): AgentLoopResult {
    return {
      success: status === 'COMPLETED' || status === 'MAX_STEPS_REACHED',
      status,
      goal,
      totalSteps: journey.length,
      journey,
      finalObservation,
      message,
      error,
    };
  }
}

export const agentLoop = new AgentLoop();

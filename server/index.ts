import { Router } from 'express';
import { agentRouter } from './routes/agent.ts';

export const apiRouter = Router();

apiRouter.use('/agent', agentRouter);

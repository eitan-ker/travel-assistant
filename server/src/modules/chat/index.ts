import { Router } from 'express';
import { handleChat, handleClearSession } from './handler.js';

const router = Router();

router.post('/', handleChat);
router.delete('/:sessionId', handleClearSession);

export { router as chatRouter };

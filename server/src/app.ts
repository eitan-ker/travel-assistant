import express from 'express';
import cors from 'cors';
import { chatRouter } from './modules/chat/index.js';

const app = express();

app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', provider: process.env.LLM_PROVIDER ?? 'claude' });
});

app.use('/chat', chatRouter);

export { app };

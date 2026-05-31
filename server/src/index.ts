import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { chatRouter } from './routes/chat.js';
import { loadKb } from './rag/loader.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', provider: process.env.LLM_PROVIDER ?? 'deepseek' });
});

app.use('/chat', chatRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`LLM model: ${process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'}`);
  loadKb();
});
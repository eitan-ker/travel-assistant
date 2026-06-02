import 'dotenv/config';
import { app } from './app.js';
import { loadKb } from './modules/rag/index.js';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`LLM model: ${process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'}`);
  loadKb();
});
const DIVIDER = '═'.repeat(60);
const THIN = '─'.repeat(60);
const PINK = '\x1b[38;2;173;216;230m';
const RESET = '\x1b[0m';

function label(text: string) {
  return `\n[ ${text} ]`;
}

function field(key: string, value: string | undefined) {
  const safe = value ?? '(empty)';
  const padding = ' '.repeat(Math.max(0, 14 - key.length));
  const lines = safe.split('\n');
  if (lines.length === 1) return `  ${key}${padding}: ${safe}`;
  return `  ${key}${padding}:\n${lines.map((l) => `    ${l}`).join('\n')}`;
}

export const log = {
  request(userMessage: string) {
    console.log(`\n${DIVIDER}`);
    console.log(`USER: "${userMessage}"`);
    console.log(DIVIDER);
  },

  travelAgent(draft: string, toolsUsed: string[], sources: string[]) {
    console.log(label('TRAVEL AGENT'));
    const toolsStr = toolsUsed.length > 0 ? `${PINK}${toolsUsed.join(', ')}${RESET}` : 'none';
    console.log(field('Tools called', toolsStr));
    console.log(field('Sources', sources.join(', ')));
    console.log(field('Draft', draft.slice(0, 120) + (draft.length > 120 ? '...' : '')));
  },

  toolCall(name: string, input: Record<string, string>) {
    console.log(`\n  >> tool: ${PINK}${name}${RESET}`);
    Object.entries(input)
      .map(([k, v]) => `     ${k}: ${PINK}${String(v).slice(0, 80)}${String(v).length > 80 ? '...' : ''}${RESET}`)
      .forEach((line) => console.log(line));
  },

  supervisor(name: string, verdict: string, reasoning: string, feedback?: string) {
    console.log(label(name.toUpperCase()));
    console.log(field('Verdict', verdict));
    console.log(field('Reasoning', reasoning));
    if (feedback) console.log(field('Feedback', feedback));
  },

  supervisorRetry(name: string) {
    console.log(`  >> retry triggered by ${name}`);
  },

  supervisorSkipped(name: string, reason: string) {
    console.log(label(name.toUpperCase()));
    console.log(field('Status', `SKIPPED — ${reason}`));
  },

  pipelineEnd(sources: string[]) {
    console.log(`\n${field('Final sources', sources.join(', '))}`);
    console.log(THIN + '\n');
  },
};

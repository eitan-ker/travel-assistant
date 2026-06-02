export interface ToolExecutionResult {
  content: string;
  source: string;
  clarification?: string; // set when data supervisor needs user input to resolve ambiguity
}

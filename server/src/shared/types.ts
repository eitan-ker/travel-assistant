// Cross-cutting types used across multiple modules
export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

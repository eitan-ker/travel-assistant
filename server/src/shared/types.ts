import { Role } from './enums.js';

export type { Role };

export interface Message {
  role: Role;
  content: string;
}

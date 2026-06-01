export interface KBDoc {
  id: string;
  destination: string;
  source: 'wikivoyage' | 'wikipedia';
  summary: string;
  content: string;
  embedding: number[];
}

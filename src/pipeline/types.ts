export interface ExtractedSignal {
  category: 'repeated' | 'faded' | 'resolved' | 'unspoken_effort' | 'good_day';
  quote: string;
  date: string;
  context?: string;
}
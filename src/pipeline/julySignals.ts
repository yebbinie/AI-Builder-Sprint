import julySignalsData from './fixtures/july-signals.json';
import { ExtractedSignal } from './types';

export const julySignals: ExtractedSignal[] = julySignalsData as ExtractedSignal[];

// 임시 테스트용 — resolved 프롬프트 검증만 하고 나중에 지울 것
export const testResolvedSignals: ExtractedSignal[] = [
  ...julySignalsData as ExtractedSignal[],
  {
    category: 'resolved',
    quote: '지갑 찾았다!!!!!!!!! 완전 야호다',
    date: '2026-07-25',
    context: '지갑을 잃어버렸다…… 카드 다 정지하고 주민센터도 갔다왔다',
  },
];
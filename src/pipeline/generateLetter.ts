import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtractedSignal } from './types';
import { assembleLetter } from './assemble';
import { verifyLetter } from './verify';
import { DiaryEntry, LetterParagraph } from '../types';

interface CachedLetter {
  paragraphs: LetterParagraph[];
  signature: string;
  signalsHash: string; // 추가: 이 캐시가 어떤 신호로 만들어졌는지 기록
}

function cacheKey(yearMonth: string) {
  return `letter-cache:${yearMonth}`;
}

function hashSignals(signals: ExtractedSignal[]): string {
  // 신호 배열을 간단한 문자열로 직렬화해서 비교용 해시로 사용
  return JSON.stringify(signals.map((s) => `${s.category}|${s.quote}|${s.date}`).sort());
}

export async function generateLetter(
  signals: ExtractedSignal[],
  monthLabel: string,
  getEntryByDate: (date: string) => Promise<DiaryEntry | null>,
  yearMonth: string
): Promise<{ paragraphs: LetterParagraph[]; signature: string }> {
  const currentHash = hashSignals(signals);

  try {
    const cached = await AsyncStorage.getItem(cacheKey(yearMonth));
    if (cached) {
      const parsed: CachedLetter = JSON.parse(cached);
      if (parsed.signalsHash === currentHash) {
        return parsed; // 신호가 그대로일 때만 캐시 사용
      }
      // 신호가 바뀌었으면 캐시 무시하고 아래에서 새로 생성
    }
  } catch (err) {
    console.warn('캐시 읽기 실패, 새로 생성합니다:', err);
  }

  const assembled = await assembleLetter(signals, monthLabel);
  const verified = await verifyLetter(assembled.paragraphs, getEntryByDate);

  if (verified.removedCount > 0) {
    console.warn(`편지 조립 후 검증에서 ${verified.removedCount}개 문단 제거됨`);
  }

  const result: CachedLetter = {
    paragraphs: verified.paragraphs,
    signature: assembled.signature,
    signalsHash: currentHash,
  };

  try {
    await AsyncStorage.setItem(cacheKey(yearMonth), JSON.stringify(result));
  } catch (err) {
    console.warn('캐시 저장 실패 (다음에도 새로 생성됨):', err);
  }

  return result;
}
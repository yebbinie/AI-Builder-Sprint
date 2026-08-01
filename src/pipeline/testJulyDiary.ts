import 'dotenv/config';
import { generateLetter } from './generateLetter';
import { julySignals } from './julySignals';
import { julyDiary } from '../data/julyDiary';
import { DiaryEntry } from '../types';

async function getJulyEntry(date: string): Promise<DiaryEntry | null> {
  return julyDiary[date] ?? null;
}

generateLetter(julySignals, '2026년 7월', getJulyEntry, '2026-07-julytest')
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => console.error(err));
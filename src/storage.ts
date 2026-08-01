import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiaryEntry } from './types';
import { formatDateLabel } from './dateUtils';

const STORAGE_KEY = 'chohyaru:diaryEntries';

async function readAllEntries(): Promise<Record<string, DiaryEntry>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeAllEntries(entries: Record<string, DiaryEntry>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function getDiaryEntry(date: string): Promise<DiaryEntry | null> {
  const entries = await readAllEntries();
  return entries[date] ?? null;
}

export async function saveDiaryEntry(date: string, content: string): Promise<void> {
  const entries = await readAllEntries();
  const existing = entries[date];
  entries[date] = { ...existing, date, dateLabel: formatDateLabel(date), body: content };
  await writeAllEntries(entries);
}

export async function deleteDiaryEntry(date: string): Promise<void> {
  const entries = await readAllEntries();
  delete entries[date];
  await writeAllEntries(entries);
}

// yearMonth: 'YYYY-MM'
export async function getEntriesForMonth(yearMonth: string): Promise<DiaryEntry[]> {
  const entries = await readAllEntries();
  return Object.values(entries)
    .filter((entry) => entry.date.startsWith(yearMonth))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const PIN_KEY = 'chohyaru:pin';

export async function getPin(): Promise<string | null> {
  return AsyncStorage.getItem(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  await AsyncStorage.setItem(PIN_KEY, pin);
}
import { julyDiary } from './src/data/julyDiary';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, GowunBatang_400Regular } from '@expo-google-fonts/gowun-batang';
import PinScreen from './src/screens/PinScreen';
import { ThemeProvider, useTheme } from './src/ThemeContext';
import LockScreen from './src/screens/LockScreen';
import HomeScreen from './src/screens/HomeScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import EnvelopeScreen from './src/screens/EnvelopeScreen';
import LetterScreen from './src/screens/LetterScreen';
import DiaryDetailScreen from './src/screens/DiaryDetailScreen';
import DiaryWriteScreen from './src/screens/DiaryWriteScreen';
import LetterboxScreen from './src/screens/LetterboxScreen';
import OcrReviewScreen from './src/screens/OcrReviewScreen';
import { entries } from './src/data/mockData';
import { formatDateLabel } from './src/dateUtils';
import { getDiaryEntry, saveDiaryEntry } from './src/storage';
import { DiaryEntry } from './src/types';

function todayDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

type Screen = 'lock' | 'pin' | 'home' | 'cal' | 'envelope' | 'letter' | 'diary' | 'write' | 'letterbox' | 'ocr';

function AppInner() {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<Screen>('lock');
  const [demoMode, setDemoMode] = useState(false);
  const [diaryDate, setDiaryDate] = useState<string | null>(null);
  const [diaryFromLetter, setDiaryFromLetter] = useState(false);
  const [diaryQuote, setDiaryQuote] = useState<string | null>(null);
  const [writeDate, setWriteDate] = useState<string | null>(null);
  const [ocrImageUri, setOcrImageUri] = useState<string | null>(null);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [diaryLoading, setDiaryLoading] = useState(false);

  const todayDate = todayDateString();
  const todayLabel = formatDateLabel(todayDate);

  useEffect(() => {
    if (!diaryDate) {
      setCurrentEntry(null);
      return;
    }
    let active = true;
    setDiaryLoading(true);
    getDiaryEntry(diaryDate).then((saved) => {
      if (!active) return;
      setCurrentEntry(saved ?? julyDiary[diaryDate] ?? entries[diaryDate] ?? null);
      setDiaryLoading(false);
    });
    return () => {
      active = false;
    };
  }, [diaryDate]);

  function handleUnlock() {
    // 데모 모드일 때는 "이번 달 1일 첫 실행"으로 강제 취급해 편지로 바로 진입한다.
    // 실제 로직: 오늘이 매달 1일 && 이번 달 첫 실행인지 확인.
    setScreen(demoMode ? 'envelope' : 'home');
  }

  async function handleSelectDay(day: number) {
    if (day === 1) {
      setScreen('envelope');
      return;
    }
    const date = `2026-07-${String(day).padStart(2, '0')}`;
    const saved = await getDiaryEntry(date);
    if (saved || julyDiary[date] || entries[date]) {
      setDiaryDate(date);
      setDiaryFromLetter(false);
      setDiaryQuote(null);
      setScreen('diary');
    } else {
      // 안 쓴 날: "놓쳤다"가 아니라 "아직 안 썼다" — 그 날짜 일기 쓰기 화면으로 이동 (plan.md §7 [2])
      setWriteDate(date);
      setScreen('write');
    }
  }

  function handleQuoteTap(date: string, quote: string) {
    setDiaryDate(date);
    setDiaryFromLetter(true);
    setDiaryQuote(quote);
    setScreen('diary');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="auto" />
      {screen === 'lock' && (
        <LockScreen
          onUnlock={handleUnlock}
          onNeedPin={() => setScreen('pin')}
          demoMode={demoMode}
          onToggleDemoMode={() => setDemoMode((v) => !v)}
        />
      )}
      {screen === 'pin' && <PinScreen onSuccess={handleUnlock} />}
      {screen === 'home' && (
        <HomeScreen
          date={todayDate}
          dateLabel={todayLabel}
          onOpenCalendar={() => setScreen('cal')}
          onOpenLetterbox={() => setScreen('letterbox')}
          onPickPhoto={(uri) => {
            setOcrImageUri(uri);
            setScreen('ocr');
          }}
        />
      )}
      {screen === 'cal' && <CalendarScreen onBack={() => setScreen('home')} onSelectDay={handleSelectDay} />}
      {screen === 'envelope' && <EnvelopeScreen onOpen={() => setScreen('letter')} />}
      {screen === 'letter' && <LetterScreen onQuoteTap={handleQuoteTap} onBack={() => setScreen('home')} />}
      {screen === 'diary' && diaryLoading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      {screen === 'diary' && !diaryLoading && currentEntry && (
        <DiaryDetailScreen
          entry={currentEntry}
          fromLetter={diaryFromLetter}
          quote={diaryQuote ?? undefined}
          onBack={() => setScreen(diaryFromLetter ? 'letter' : 'cal')}
        />
      )}
      {screen === 'write' && writeDate && (
        <DiaryWriteScreen date={writeDate} onBack={() => setScreen('cal')} onSaved={() => setScreen('cal')} />
      )}
      {screen === 'ocr' && ocrImageUri && (
        <OcrReviewScreen
          imageUri={ocrImageUri}
          onCancel={() => setScreen('home')}
          onConfirm={async (text) => {
            console.log('[OCR 저장 시도]', todayDate, text.slice(0, 20));
            try {
              await saveDiaryEntry(todayDate, text);
              console.log('[OCR 저장 성공]');
            } catch (err) {
              console.error('[OCR 저장 실패]', err);
            }
            setScreen('home');
          }}
        />
      )}
      {screen === 'letterbox' && (
        <LetterboxScreen onBack={() => setScreen('home')} onSelectLetter={() => setScreen('envelope')} />
      )}
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ GowunBatang_400Regular });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { entries as mockEntries } from '../data/mockData';
import { getEntriesForMonth } from '../storage';
import { julyDiary } from '../data/julyDiary';

interface Props {
  onBack: () => void;
  onSelectDay: (day: number) => void;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const LEADING_BLANKS = 3; // 2026년 7월 1일은 수요일
const DAYS_IN_MONTH = 31;
const CELL = `${100 / 7}%` as const;
const YEAR_MONTH = '2026-07';

function dayOf(dateKey: string): number {
  return Number(dateKey.slice(-2));
}

const demoWrittenDays = new Set([
  ...Object.keys(mockEntries).map(dayOf),
  ...Object.keys(julyDiary).map(dayOf),
]);

export default function CalendarScreen({ onBack, onSelectDay }: Props) {
  const { colors } = useTheme();
  const days = Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1);
  const cells: (number | null)[] = [
    ...Array.from({ length: LEADING_BLANKS }, () => null),
    ...days,
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  const [writtenDays, setWrittenDays] = useState<number[]>(Array.from(demoWrittenDays));

  useEffect(() => {
    let active = true;
    getEntriesForMonth(YEAR_MONTH).then((saved) => {
      if (!active) return;
      const merged = new Set(demoWrittenDays);
      saved.forEach((entry) => merged.add(dayOf(entry.date)));
      setWrittenDays(Array.from(merged));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={{ color: colors.sub, fontSize: 13 }}>‹ 오늘</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>2026년 7월</Text>
      <Text style={[styles.subtitle, { color: colors.sub }]}>{writtenDays.length}일의 기록</Text>

      <View style={styles.dowRow}>
        {DOW.map((d) => (
          <Text key={d} style={[styles.dow, { color: colors.sub }]}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((d, cellIndex) => {
            if (d === null) {
              return <View key={cellIndex} style={styles.dayCell} />;
            }
            const has = writtenDays.includes(d);
            const isLetterDay = d === 1;
            return (
              <Pressable key={cellIndex} style={styles.dayCell} onPress={() => onSelectDay(d)}>
                <Text style={{ color: isLetterDay ? colors.accent : colors.text, fontSize: 14 }}>{d}</Text>
                {has ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : <View style={styles.dotEmpty} />}
              </Pressable>
            );
          })}
        </View>
      ))}

      <Text style={[styles.note, { color: colors.sub }]}>쓴 날에만 점이 찍힙니다.{'\n'}안 쓴 날은 표시하지 않습니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52, paddingHorizontal: 26, paddingBottom: 26 },
  backRow: { marginBottom: 22 },
  title: { fontFamily: 'GowunBatang_400Regular', fontSize: 19, marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 26 },
  dowRow: { flexDirection: 'row' },
  weekRow: { flexDirection: 'row' },
  dow: { width: CELL, textAlign: 'center', fontSize: 11, paddingBottom: 10 },
  dayCell: { width: CELL, height: 46, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 5 },
  dotEmpty: { height: 4, marginTop: 5 },
  note: { marginTop: 'auto', fontSize: 12, lineHeight: 19 },
});
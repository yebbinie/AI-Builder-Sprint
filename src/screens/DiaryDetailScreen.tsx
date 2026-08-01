import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { DiaryEntry } from '../types';

interface Props {
  entry: DiaryEntry;
  fromLetter: boolean;
  quote?: string;
  onBack: () => void;
}

export default function DiaryDetailScreen({ entry, fromLetter, quote, onBack }: Props) {
  const { colors } = useTheme();
  // 편지에서 탭한 인용문(quote)은 verify.ts가 원문 존재를 이미 보장한 값이라 우선 사용.
  // 목데이터 스켈레톤은 highlight 필드가 편지 인용문과 손으로 다르게 쓰여 있어 quote가 안 맞을 수 있어 폴백 유지.
  const highlightText =
    fromLetter && quote && entry.body.includes(quote)
      ? quote
      : fromLetter && entry.highlight && entry.body.includes(entry.highlight)
        ? entry.highlight
        : undefined;
  const showHighlight = !!highlightText;
  const parts = showHighlight ? entry.body.split(highlightText as string) : [entry.body];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={{ color: colors.sub, fontSize: 13 }}>‹ {fromLetter ? '편지로 돌아가기' : '캘린더로 돌아가기'}</Text>
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{entry.dateLabel}</Text>
      <Text style={[styles.body, { color: colors.text }]}>
        {showHighlight ? (
          <>
            <Text>{parts[0]}</Text>
            <Text style={{ backgroundColor: colors.mark }}>{highlightText}</Text>
            <Text>{parts[1]}</Text>
          </>
        ) : (
          entry.body
        )}
      </Text>
      {fromLetter && <Text style={[styles.note, { color: colors.sub }]}>편지에서 인용된 문장입니다</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52, paddingHorizontal: 26, paddingBottom: 26 },
  backRow: { marginBottom: 22 },
  title: { fontFamily: 'GowunBatang_400Regular', fontSize: 18, marginBottom: 20 },
  body: { fontFamily: 'GowunBatang_400Regular', fontSize: 16, lineHeight: 32 },
  note: { marginTop: 'auto', fontSize: 12 },
});
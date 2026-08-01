import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '../ThemeContext';
import {
  letterMonthLabel as mockMonthLabel,
  letterParagraphs as mockParagraphs,
  letterSignature as mockSignature,
} from '../data/mockData';
import { generateLetter } from '../pipeline/generateLetter';
import { julySignals } from '../pipeline/julySignals';
import { julyDiary } from '../data/julyDiary';
import { DiaryEntry, LetterParagraph } from '../types';

interface Props {
onQuoteTap: (date: string, quote: string) => void;
  onBack: () => void;
}

export default function LetterScreen({ onQuoteTap, onBack }: Props) {
  const { colors } = useTheme();
  const [monthLabel, setMonthLabel] = useState(mockMonthLabel);
  const [paragraphs, setParagraphs] = useState<LetterParagraph[]>(mockParagraphs);
  const [signature, setSignature] = useState(mockSignature);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const getJulyEntry = async (date: string): Promise<DiaryEntry | null> =>
      julyDiary[date] ?? null;

    generateLetter(julySignals, '2026년 7월', getJulyEntry, '2026-07-julydiary')
      .then((result) => {
        if (cancelled) return;
        if (result.paragraphs.length > 0) {
          setParagraphs(result.paragraphs);
          setSignature(result.signature);
          setMonthLabel('2026년 7월');
        }
      })
      .catch((err) => {
        console.warn('편지 생성 실패, mock 편지로 대체:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerLoading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={{ color: colors.sub, fontSize: 13 }}>‹ 홈으로</Text>
      </Pressable>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.month, { color: colors.sub }]}>{monthLabel}</Text>
        {paragraphs.map((para, i) => (
          <Text key={i} style={[styles.paragraph, { color: colors.text }]}>
            {para.segments.map((seg, j) =>
              seg.type === 'quote' ? (
                <Text
                  key={j}
                  onPress={() => onQuoteTap(seg.date, seg.content)}
                  style={[styles.quote, { color: colors.accent, borderBottomColor: colors.accent }]}
                >
                  {seg.content}
                </Text>
              ) : (
                <Text key={j}>{seg.content}</Text>
              )
            )}
          </Text>
        ))}
        <Text style={[styles.signature, { color: colors.sub }]}>{signature}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52, paddingHorizontal: 26, paddingBottom: 26 },
  centerLoading: { alignItems: 'center', justifyContent: 'center' },
  backRow: { marginBottom: 16},
  scroll: { flex: 1 },
  month: { fontFamily: 'GowunBatang_400Regular', fontSize: 13, textAlign: 'center', marginBottom: 26 },
  paragraph: { fontFamily: 'GowunBatang_400Regular', fontSize: 15.5, lineHeight: 31, marginBottom: 22 },
  quote: { borderBottomWidth: 1 },
  signature: { fontSize: 14, textAlign: 'right', marginTop: 12, marginBottom: 20 },
});
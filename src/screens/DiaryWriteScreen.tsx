import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { getDiaryEntry, saveDiaryEntry } from '../storage';
import { formatDateLabel } from '../dateUtils';
import DismissKeyboardView from '../components/DismissKeyboardView';

interface Props {
  date: string; // 'YYYY-MM-DD'
  onBack: () => void;
  onSaved: () => void;
}

export default function DiaryWriteScreen({ date, onBack, onSaved }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');

  useEffect(() => {
    let active = true;
    setText('');
    getDiaryEntry(date).then((entry) => {
      if (active && entry) setText(entry.body);
    });
    return () => {
      active = false;
    };
  }, [date]);

  async function handleSave() {
    if (!text.trim()) return;
    await saveDiaryEntry(date, text);
    onSaved();
  }

  return (
    <DismissKeyboardView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onBack} style={styles.backRow}>
        <Text style={{ color: colors.sub, fontSize: 13 }}>‹ 캘린더로 돌아가기</Text>
      </Pressable>
      <Text style={[styles.date, { color: colors.text }]}>{formatDateLabel(date)}</Text>
      <TextInput
        style={[styles.writer, { color: colors.text }]}
        placeholder="이 날은..."
        placeholderTextColor={colors.ph}
        multiline
        textAlignVertical="top"
        value={text}
        onChangeText={setText}
        autoFocus
      />
      <View style={[styles.foot, { borderTopColor: colors.line }]}>
        <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave}>
          <Text style={{ color: colors.bg, fontSize: 14 }}>저장</Text>
        </Pressable>
      </View>
    </DismissKeyboardView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52, paddingHorizontal: 26, paddingBottom: 26 },
  backRow: { marginBottom: 22 },
  date: { fontFamily: 'GowunBatang_400Regular', fontSize: 18, marginBottom: 20 },
  writer: { flex: 1, fontFamily: 'GowunBatang_400Regular', fontSize: 16, lineHeight: 30 },
  foot: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16, borderTopWidth: 1 },
  saveBtn: { paddingVertical: 9, paddingHorizontal: 20, borderRadius: 20 },
});

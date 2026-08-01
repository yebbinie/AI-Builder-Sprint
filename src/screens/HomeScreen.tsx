import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { getDiaryEntry, saveDiaryEntry } from '../storage';
import { MailIcon, CalendarIcon } from '../components/icons';
import DismissKeyboardView from '../components/DismissKeyboardView';

interface Props {
  date: string; // 'YYYY-MM-DD'
  dateLabel: string;
  onOpenCalendar: () => void;
  onOpenLetterbox: () => void;
  onPickPhoto: (uri: string) => void;
}

export default function HomeScreen({ date, dateLabel, onOpenCalendar, onOpenLetterbox, onPickPhoto }: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
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
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <DismissKeyboardView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.top}>
        <Text style={[styles.date, { color: colors.text }]}>{dateLabel}</Text>
        <View style={styles.icons}>
          <Pressable onPress={onOpenLetterbox}>
            <MailIcon color={colors.sub} />
          </Pressable>
          <Pressable onPress={onOpenCalendar}>
            <CalendarIcon color={colors.sub} />
          </Pressable>
        </View>
      </View>
      <TextInput
        style={[styles.writer, { color: colors.text }]}
        placeholder="오늘은..."
        placeholderTextColor={colors.ph}
        multiline
        textAlignVertical="top"
        value={text}
        onChangeText={setText}
      />
      <View style={[styles.foot, { borderTopColor: colors.line }]}>
<Pressable
          onPress={async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
            if (!result.canceled && result.assets[0]) {
              onPickPhoto(result.assets[0].uri);
            }
          }}
        >
          <Text style={{ color: colors.sub, fontSize: 13 }}>사진</Text>
        </Pressable>
        <View style={styles.saveRow}>
          {saved && <Text style={{ color: colors.sub, fontSize: 13 }}>저장됨</Text>}
          <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave}>
            <Text style={{ color: colors.bg, fontSize: 14 }}>저장</Text>
          </Pressable>
        </View>
      </View>
    </DismissKeyboardView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52, paddingHorizontal: 26, paddingBottom: 26 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  date: { fontSize: 15, fontWeight: '500' },
  icons: { flexDirection: 'row', gap: 16 },
  writer: { flex: 1, fontFamily: 'GowunBatang_400Regular', fontSize: 16, lineHeight: 30 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  saveBtn: { paddingVertical: 9, paddingHorizontal: 20, borderRadius: 20 },
});
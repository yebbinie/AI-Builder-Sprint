import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../ThemeContext';
import { parseImageToText } from '../ocr/upstageOcr';

interface Props {
  imageUri: string;
  onCancel: () => void;
  onConfirm: (text: string) => void;
}

export default function OcrReviewScreen({ imageUri, onCancel, onConfirm }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    parseImageToText(imageUri)
      .then((result) => {
        if (!cancelled) setText(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'OCR 처리 중 문제가 발생했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onCancel} style={styles.backRow}>
        <Text style={{ color: colors.sub, fontSize: 13 }}>‹ 취소</Text>
      </Pressable>

      <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />

      <Text style={[styles.label, { color: colors.sub }]}>
        인식된 글자예요. 틀린 부분은 직접 고쳐주세요.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={[styles.error, { color: colors.sub }]}>{error}</Text>
      ) : (
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          blurOnSubmit
          returnKeyType="done"
        />
      )}

      {!loading && !error && (
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          onPress={() => onConfirm(text)}
        >
          <Text style={{ color: colors.bg, fontSize: 14 }}>이대로 저장</Text>
        </Pressable>
      )}
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 52, paddingHorizontal: 26, paddingBottom: 26 },
  backRow: { marginBottom: 16 },
  preview: { width: '100%', height: 160, marginBottom: 16 },
  label: { fontSize: 12, marginBottom: 12 },
  input: {
    flex: 1,
    fontFamily: 'GowunBatang_400Regular',
    fontSize: 16,
    lineHeight: 28,
  },
  error: { fontSize: 14, marginTop: 24 },
  saveBtn: { paddingVertical: 10, borderRadius: 20, alignItems: 'center', marginTop: 16 },
});
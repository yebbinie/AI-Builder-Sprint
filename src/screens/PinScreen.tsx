import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeContext';
import { getPin, setPin } from '../storage';

interface Props {
  onSuccess: () => void;
}

const PIN_LENGTH = 4;
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PinScreen({ onSuccess }: Props) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'checking' | 'setup' | 'confirm' | 'verify'>('checking');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState(false);

  React.useEffect(() => {
    getPin().then((saved) => {
      setMode(saved ? 'verify' : 'setup');
    });
  }, []);

  function handlePress(key: string) {
    setError(false);
    if (key === '⌫') {
      setInput((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '' || input.length >= PIN_LENGTH) return;

    const next = input + key;
    setInput(next);

    if (next.length === PIN_LENGTH) {
      handleComplete(next);
    }
  }

  async function handleComplete(pin: string) {
    if (mode === 'setup') {
      setFirstPin(pin);
      setMode('confirm');
      setInput('');
    } else if (mode === 'confirm') {
      if (pin === firstPin) {
        await setPin(pin);
        onSuccess();
      } else {
        setError(true);
        setInput('');
        setMode('setup');
        setFirstPin('');
      }
    } else if (mode === 'verify') {
      const saved = await getPin();
      if (pin === saved) {
        onSuccess();
      } else {
        setError(true);
        setInput('');
      }
    }
  }

  const title =
    mode === 'setup' ? 'PIN 4자리를 만들어주세요'
    : mode === 'confirm' ? '한 번 더 입력해주세요'
    : 'PIN을 입력해주세요';

  if (mode === 'checking') return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {error && <Text style={[styles.error, { color: colors.accent }]}>PIN이 일치하지 않아요</Text>}

      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: colors.sub },
              i < input.length && { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {KEYPAD.map((key, i) => (
          <Pressable
            key={i}
            style={styles.key}
            disabled={key === ''}
            onPress={() => handlePress(key)}
          >
            <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 },
  title: { fontSize: 15, marginBottom: 8 },
  error: { fontSize: 12, marginBottom: 12 },
  dots: { flexDirection: 'row', gap: 16, marginVertical: 32 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.4 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', width: 240, justifyContent: 'center' },
  key: { width: 80, height: 64, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 22 },
});
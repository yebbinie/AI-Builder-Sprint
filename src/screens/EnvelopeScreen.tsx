import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useTheme } from '../ThemeContext';

interface Props {
  onOpen: () => void;
}

const ENV_WIDTH = 190;
const FLAP_HEIGHT = 70;

export default function EnvelopeScreen({ onOpen }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable onPress={onOpen} style={[styles.env, { borderColor: colors.line, backgroundColor: colors.envBody }]}>
        <Svg width={ENV_WIDTH} height={FLAP_HEIGHT} viewBox={`0 0 ${ENV_WIDTH} ${FLAP_HEIGHT}`} style={styles.flap}>
          <Polygon
            points={`0,0 ${ENV_WIDTH},0 ${ENV_WIDTH / 2},${FLAP_HEIGHT}`}
            fill={colors.envFlap}
            stroke={colors.line}
            strokeWidth={1}
          />
        </Svg>
        <View style={[styles.seal, { backgroundColor: colors.accent }]} />
      </Pressable>
      <Text style={[styles.text, { color: colors.text }]}>7월의 편지가 도착했습니다</Text>
      <Text style={[styles.sub, { color: colors.sub }]}>봉투를 눌러 열기</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  env: { width: 190, height: 126, borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  flap: { position: 'absolute', top: 0, left: 0 },
  seal: { position: 'absolute', left: '50%', top: 62, marginLeft: -13, width: 26, height: 26, borderRadius: 13 },
  text: { fontFamily: 'GowunBatang_400Regular', fontSize: 15, marginTop: 30 },
  sub: { fontSize: 12, marginTop: 8 },
});
import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

export function MailIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={5} width={20} height={14} rx={2} stroke={color} strokeWidth={1.4} />
      <Path d="M2 7l10 7 10-7" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

export function CalendarIcon({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={16} rx={2} stroke={color} strokeWidth={1.4} />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={color} strokeWidth={1.4} />
    </Svg>
  );
}

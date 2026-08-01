import React from 'react';
import { Keyboard, TouchableWithoutFeedback, View, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function DismissKeyboardView({ children, style }: Props) {
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </TouchableWithoutFeedback>
  );
}
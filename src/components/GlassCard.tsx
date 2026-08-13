import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { palette } from '../theme/tokens';

type GlassCardProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function GlassCard({ children, style }: GlassCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 18,
    backgroundColor: palette.panel,
    padding: 16,
  },
});
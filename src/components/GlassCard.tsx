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
    backgroundColor: palette.surface,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
});
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import GlassCard from './GlassCard';
import { fonts, palette } from '../theme/tokens';

type MetricCardProps = {
  label: string;
  value: string;
  valueColor?: string;
  style?: StyleProp<ViewStyle>;
};

export default function MetricCard({ label, value, valueColor = palette.textPrimary, style }: MetricCardProps) {
  return (
    <GlassCard style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  label: {
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  value: {
    marginTop: 6,
    fontFamily: fonts.headingMedium,
    fontSize: 22,
  },
});
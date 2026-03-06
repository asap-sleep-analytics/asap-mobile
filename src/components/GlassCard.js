import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../theme/tokens';

export default function GlassCard({ children, style }) {
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

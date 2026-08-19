import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '../theme/tokens';

type LoadingStateProps = {
  message?: string;
};

export default function LoadingState({ message = 'Cargando...' }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  text: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
});
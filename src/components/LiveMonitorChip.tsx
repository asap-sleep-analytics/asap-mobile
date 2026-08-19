import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppContext } from '../context/AppContext';
import { fonts, palette } from '../theme/tokens';

export default function LiveMonitorChip() {
  const { activeSleepSessionId } = useContext(AppContext);
  const navigation = useNavigation<any>();
  const route = useRoute();

  if (!activeSleepSessionId || route.name === 'MonitorActive' || route.name === 'MonitorSummary') {
    return null;
  }

  return (
    <Pressable
      onPress={() => navigation.navigate('MonitorTab', { screen: 'MonitorActive' })}
      style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel="Monitoreo en curso, toca para volver"
    >
      <View style={styles.dot} />
      <Text style={styles.label}>En curso</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  label: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.75,
  },
});

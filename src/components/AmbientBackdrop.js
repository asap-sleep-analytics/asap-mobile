import React from 'react';
import { StyleSheet, View } from 'react-native';

import { palette } from '../theme/tokens';

export default function AmbientBackdrop({ children }) {
  return (
    <View style={styles.root}>
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />
      <View style={[styles.glow, styles.glowMid]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.obsidian,
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: palette.mint,
    opacity: 0.08,
  },
  glowTop: {
    width: 220,
    height: 220,
    top: -80,
    right: -60,
  },
  glowBottom: {
    width: 240,
    height: 240,
    bottom: -120,
    left: -70,
  },
  glowMid: {
    width: 180,
    height: 180,
    top: 220,
    left: 180,
    opacity: 0.05,
  },
});

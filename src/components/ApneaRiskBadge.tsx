import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RiskVisual } from '../utils/apneaRisk';
import { fonts } from '../theme/tokens';

type ApneaRiskBadgeProps = {
  visual: RiskVisual;
  size?: 'sm' | 'md' | 'lg';
};

export default function ApneaRiskBadge({ visual, size = 'md' }: ApneaRiskBadgeProps) {
  const isCompact = size === 'sm';
  const isLarge = size === 'lg';

  return (
    <View style={[styles.badge, { backgroundColor: visual.softColor, borderColor: visual.color }, isCompact ? styles.badgeSm : null]}>
      <View style={[styles.dot, { backgroundColor: visual.color }]} />
      <Text style={[styles.text, { color: visual.color }, isCompact ? styles.textSm : null, isLarge ? styles.textLg : null]}>
        {visual.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  badgeSm: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  textSm: {
    fontSize: 11,
  },
  textLg: {
    fontSize: 15,
  },
});
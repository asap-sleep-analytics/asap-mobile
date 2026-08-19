import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fonts, palette } from '../theme/tokens';
import { riskFromPredictionNivel } from '../utils/apneaRisk';

interface ApneaResultCardProps {
  result: {
    nivel: string;
    interpretacion: string;
    probabilidad: number;
    detalle?: unknown;
    modo?: string;
    version?: string;
  } | null;
}

export default function ApneaResultCard({ result }: ApneaResultCardProps) {
  if (!result) {
    return null;
  }

  const visual = riskFromPredictionNivel(result.nivel);
  const prob = (result.probabilidad * 100).toFixed(1);

  return (
    <View
      style={[
        componentStyles.container,
        { borderColor: visual.color, backgroundColor: visual.softColor },
      ]}
    >
      <View style={componentStyles.header}>
        <View style={[componentStyles.badge, { backgroundColor: visual.color }]}>
          <Text style={componentStyles.levelText}>{visual.label}</Text>
        </View>
        <View style={componentStyles.probWrap}>
          <Text style={[componentStyles.probability, { color: visual.color }]}>{prob}%</Text>
          <Text style={componentStyles.probLabel}>certeza del modelo</Text>
        </View>
      </View>

      <Text style={[componentStyles.interpretation, { color: visual.color }]}>
        {result.interpretacion}
      </Text>
    </View>
  );
}

const componentStyles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  levelText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  probWrap: {
    alignItems: 'flex-end',
  },
  probability: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  probLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
  },
  interpretation: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
});
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { palette, fonts } from '../theme/tokens';

const LEVEL_STYLES = {
  NORMAL: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    badgeColor: '#10B981',
    textColor: '#047857',
  },
  ALERTA: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    badgeColor: '#F59E0B',
    textColor: '#B45309',
  },
  CRITICO: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    badgeColor: '#EF4444',
    textColor: '#991B1B',
  },
};

/**
 * Componente para mostrar resultado de detección de apnea
 * @param {Object} result - Resultado de la predicción
 * @param {string} result.nivel - NORMAL, ALERTA o CRITICO
 * @param {string} result.interpretacion - Texto de interpretación
 * @param {number} result.probabilidad - Probabilidad (0-1)
 * @param {Object} result.detalle - Detalles de la predicción
 */
export default function ApneaResultCard({ result }) {
  if (!result) {
    return null;
  }

  const styles = LEVEL_STYLES[result.nivel] || LEVEL_STYLES.NORMAL;
  const prob = (result.probabilidad * 100).toFixed(1);

  return (
    <View style={[componentStyles.container, { borderColor: styles.borderColor, backgroundColor: styles.backgroundColor }]}>
      {/* Header con nivel */}
      <View style={componentStyles.header}>
        <View style={[componentStyles.badge, { backgroundColor: styles.badgeColor }]}>
          <Text style={[componentStyles.levelText, { color: '#FFFFFF' }]}>{result.nivel}</Text>
        </View>
        <Text style={[componentStyles.probability, { color: styles.textColor }]}>{prob}%</Text>
      </View>

      {/* Interpretación */}
      <Text style={[componentStyles.interpretation, { color: styles.textColor }]}>{result.interpretacion}</Text>

      {/* Detalles */}
      {result.detalle && (
        <View style={componentStyles.details}>
          <DetailRow
            label="Prob. Audio"
            value={`${(result.detalle.prob_audio * 100).toFixed(1)}%`}
            color={styles.textColor}
          />
          <DetailRow label="Prob. SpO2" value={`${(result.detalle.prob_spo2 * 100).toFixed(1)}%`} color={styles.textColor} />
          <DetailRow label="SpO2 Drop" value={`${result.detalle.spo2_drop_pts.toFixed(1)} pts`} color={styles.textColor} />

          {result.detalle.peso_audio !== undefined && (
            <DetailRow
              label="Pesos"
              value={`Audio: ${(result.detalle.peso_audio * 100).toFixed(0)}% | SpO2: ${(result.detalle.peso_spo2 * 100).toFixed(0)}%`}
              color={styles.textColor}
              small
            />
          )}
        </View>
      )}

      {/* Modo y versión */}
      <View style={componentStyles.footer}>
        <Text style={[componentStyles.meta, { color: styles.textColor }]}>
          Modo: {result.modo} • v{result.version?.split('_')[0] || 'v3'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Fila de detalle
 */
function DetailRow({ label, value, color, small }) {
  return (
    <View style={componentStyles.detailRow}>
      <Text style={[componentStyles.detailLabel, { color }, small && componentStyles.small]}>{label}</Text>
      <Text style={[componentStyles.detailValue, { color }, small && componentStyles.small]}>{value}</Text>
    </View>
  );
}

const componentStyles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    marginVertical: 12,
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
    borderRadius: 6,
  },

  levelText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },

  probability: {
    fontFamily: fonts.heading,
    fontSize: 18,
  },

  interpretation: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },

  details: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
    marginBottom: 12,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  detailLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
  },

  detailValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },

  small: {
    fontSize: 11,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 8,
  },

  meta: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
  },
});

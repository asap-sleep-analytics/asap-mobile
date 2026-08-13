import React, { useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { AppContext } from '../../../context/AppContext';
import { fonts, palette } from '../../../theme/tokens';
import type { SleepSessionRecord } from '../../../types';

interface Props {
  route: { params?: { session?: SleepSessionRecord | null } };
  navigation: {
    goBack: () => void;
    getParent: () => { navigate: (screen: string) => void } | undefined;
  };
}

function formatDuration(startTime?: string | null, endTime?: string | null): string {
  if (!startTime || !endTime) {
    return '--';
  }
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return '--';
  }
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
}

function getConclusion(score: number, apnea: number): { label: string; color: string; message: string } {
  if (score >= 82 && apnea <= 2) {
    return {
      label: 'Buena noche',
      color: palette.mint,
      message: 'Tu descanso fue estable y con pocos eventos respiratorios. Sigue con tu rutina.',
    };
  }
  if (score >= 65) {
    return {
      label: 'Noche intermedia',
      color: palette.warning,
      message: 'Se registró algo de interrupción. Intenta dormir de lado y mantener un horario fijo.',
    };
  }
  return {
    label: 'Noche irregular',
    color: palette.danger,
    message: 'Se detectaron varios eventos. Te recomendamos consultar con un especialista del sueño.',
  };
}

export default function MonitorSummaryScreen({ route, navigation }: Props) {
  const { setActiveSleepSessionId } = useContext(AppContext);
  const session = route?.params?.session || null;

  const score = session?.sleep_score ?? 0;
  const apnea = session?.apnea_events ?? 0;
  const snore = session?.snore_count ?? 0;
  const conclusion = getConclusion(score, apnea);

  const handleGoToHistory = () => {
    setActiveSleepSessionId('');
    navigation.getParent()?.navigate('HistoryTab');
  };

  const handleBackToMonitor = () => {
    setActiveSleepSessionId('');
    navigation.goBack();
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Monitoreo finalizado</Text>
        <Text style={styles.title}>Resumen de tu noche</Text>
        <Text style={styles.subtitle}>
          Tu grabación se guardó en el historial. Esto es lo que registramos esta sesión.
        </Text>

        <GlassCard style={styles.scoreCard}>
          <Text style={[styles.scoreValue, { color: conclusion.color }]}>{score}</Text>
          <Text style={styles.scoreLabel}>Puntuación de sueño</Text>
          <View style={[styles.conclusionBadge, { borderColor: conclusion.color }]}>
            <Text style={[styles.conclusionText, { color: conclusion.color }]}>{conclusion.label}</Text>
          </View>
          <Text style={styles.conclusionMessage}>{conclusion.message}</Text>
        </GlassCard>

        <View style={styles.metricRow}>
          <GlassCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Duración</Text>
            <Text style={styles.metricValue}>{formatDuration(session?.start_time, session?.end_time)}</Text>
          </GlassCard>
          <GlassCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Apneas</Text>
            <Text style={[styles.metricValue, { color: apnea > 0 ? palette.danger : palette.mint }]}>{apnea}</Text>
          </GlassCard>
          <GlassCard style={styles.metricCard}>
            <Text style={styles.metricLabel}>Ronquidos</Text>
            <Text style={styles.metricValue}>{snore}</Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.actionsCard}>
          <Text style={styles.actionsHint}>Puedes ver el detalle completo y exportar tu reporte desde el historial.</Text>
          <Pressable
            onPress={handleGoToHistory}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryButtonText}>Ver mi historial</Text>
          </Pressable>
          <Pressable
            onPress={handleBackToMonitor}
            style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.ghostButtonText}>Volver al monitor</Text>
          </Pressable>
        </GlassCard>

        <Text style={styles.disclaimer}>
          Información orientativa. No sustituye un diagnóstico médico profesional.
        </Text>
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'rgba(110,247,207,0.09)',
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  title: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  scoreCard: {
    alignItems: 'center',
    borderColor: 'rgba(110,247,207,0.3)',
    backgroundColor: 'rgba(9,22,18,0.84)',
    paddingVertical: 22,
  },
  scoreValue: {
    fontFamily: fonts.heading,
    fontSize: 64,
    lineHeight: 70,
  },
  scoreLabel: {
    marginTop: 2,
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  conclusionBadge: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  conclusionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  conclusionMessage: {
    marginTop: 12,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  metricLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricValue: {
    marginTop: 6,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 22,
  },
  actionsCard: {
    borderColor: 'rgba(149,178,255,0.34)',
    backgroundColor: 'rgba(13,18,31,0.82)',
  },
  actionsHint: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 19,
    marginBottom: 12,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  ghostButton: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.82,
  },
  disclaimer: {
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import AppButton from '../../../components/AppButton';
import GlassCard from '../../../components/GlassCard';
import MetricCard from '../../../components/MetricCard';
import SectionBadge from '../../../components/SectionBadge';
import { AppContext } from '../../../context/AppContext';
import { fonts, palette } from '../../../theme/tokens';
import type { SleepSessionRecord } from '../../../types';
import { formatDurationMinutes } from '../../../utils/dates';

interface Props {
  route: { params?: { session?: SleepSessionRecord | null } };
  navigation: {
    goBack: () => void;
    getParent: () => { navigate: (screen: string) => void } | undefined;
  };
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
        <SectionBadge label="Monitoreo finalizado" />
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
          <MetricCard label="Duración" value={formatDurationMinutes(session?.start_time, session?.end_time)} />
          <MetricCard
            label="Apneas"
            value={String(apnea)}
            valueColor={apnea > 0 ? palette.danger : palette.mint}
          />
          <MetricCard label="Ronquidos" value={String(snore)} />
        </View>

        {session?.analysis_label ? (
          <Text style={styles.sourceNote}>{session.analysis_label}</Text>
        ) : session?.model_source === null ? (
          <Text style={styles.sourceNote}>
            Esta sesión no pudo analizarse con audio; las métricas son estimaciones locales del teléfono.
          </Text>
        ) : null}

        <GlassCard style={styles.actionsCard}>
          <Text style={styles.actionsHint}>Puedes ver el detalle completo y exportar tu reporte desde el historial.</Text>
          <AppButton label="Ver mi historial" onPress={handleGoToHistory} style={styles.primaryButton} />
          <AppButton label="Volver al monitor" onPress={handleBackToMonitor} variant="ghost" style={styles.ghostButton} />
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
  sourceNote: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
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
    width: '100%',
  },
  ghostButton: {
    marginTop: 8,
    width: '100%',
  },
  disclaimer: {
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

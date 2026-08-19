import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import CircularProgress from 'react-native-circular-progress-indicator';
import { LineChart } from 'react-native-wagmi-charts';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import ApneaRiskBadge from '../../../components/ApneaRiskBadge';
import GlassCard from '../../../components/GlassCard';
import { getApiErrorMessage, getDashboardSummary, listSleepDetections, listSleepSessions } from '../../../services/api';
import { fonts, palette } from '../../../theme/tokens';
import type { DetectionLog, SleepContinuityPoint, SleepSessionRecord } from '../../../types';
import { riskFromApneaEvents } from '../../../utils/apneaRisk';

const DEFAULT_DISCLAIMER = 'A.S.A.P. no reemplaza diagnostico clinico profesional.';

interface TimelinePoint {
  timestamp: number;
  value: number;
  label: string;
}

interface DashboardSummaryResponse {
  indicadores?: {
    sleep_score?: number;
    eventos_apnea_ronquido?: {
      ronquidos: number;
      apnea: number;
      total: number;
    };
    continuidad?: SleepContinuityPoint[];
  };
  disclaimer_medico?: string;
}

function resolveSessionStartMs(sessionStart: string | null | undefined, fallbackCount: number): number {
  const parsed = Date.parse(sessionStart || '');
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Date.now() - Math.max(fallbackCount, 1) * 30 * 1000;
}

function buildTimelineFromDetections(detections: DetectionLog[] = [], sessionStart: string | null | undefined = null): TimelinePoint[] {
  if (!Array.isArray(detections) || detections.length === 0) {
    return [];
  }

  const startMs = resolveSessionStartMs(sessionStart, detections.length);

  return detections.slice(0, 360).map((detection, index) => {
    const startSecond = Number.isFinite(Number(detection.start_second)) ? Number(detection.start_second) : index * 30;
    const endSecond = Number.isFinite(Number(detection.end_second)) ? Number(detection.end_second) : startSecond + 30;

    let value = 34;
    if (detection.label === 'Ronquido') {
      value = 72;
    }
    if (detection.label === 'Apnea') {
      value = 96;
    }

    return {
      timestamp: startMs + Math.round(((startSecond + endSecond) / 2) * 1000),
      value,
      label: detection.label || 'Normal',
    };
  });
}

function buildTimelineFromSummary(continuity: SleepContinuityPoint[] = [], sessionStart: string | null | undefined = null): TimelinePoint[] {
  if (!Array.isArray(continuity) || continuity.length === 0) {
    return [];
  }

  const startMs = resolveSessionStartMs(sessionStart, continuity.length);

  return continuity.slice(0, 360).map((point, index) => ({
    timestamp: startMs + Math.round((Number(point.minuto || index) * 60 + 30) * 1000),
    value: point.estado === 'interrupcion' ? 72 : 34,
    label: point.estado === 'interrupcion' ? 'Interrupcion' : 'Normal',
  }));
}

function buildFallbackTimeline(): TimelinePoint[] {
  const now = Date.now();
  return Array.from({ length: 20 }).map((_, index) => ({
    timestamp: now - (20 - index) * 15 * 60 * 1000,
    value: index % 7 === 0 ? 62 : 36,
    label: index % 7 === 0 ? 'Interrupcion' : 'Normal',
  }));
}

interface LoadingStateProps {
  pulse: Animated.Value;
}

function LoadingState({ pulse }: LoadingStateProps) {
  return (
    <GlassCard style={styles.loadingCard as any}>
      <View style={styles.loadingHeaderRow}>
        <Text style={styles.sectionTitle}>Preparando tu análisis de apnea</Text>
        <ActivityIndicator color={palette.primary} size="small" />
      </View>
      <Text style={styles.loadingSubtitle}>Cargando la información de tu última noche...</Text>
      <Animated.View style={[styles.loadingBarLarge, { opacity: pulse }]} />
      <Animated.View style={[styles.loadingBarMedium, { opacity: pulse }]} />
      <Animated.View style={[styles.loadingBarSmall, { opacity: pulse }]} />
    </GlassCard>
  );
}

export default function DashboardHomeScreen({ navigation }: { navigation: { getParent: () => { navigate: (screen: string) => void } | undefined; navigate: (screen: string) => void } }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const chartWidth = Math.max(170, width - (isCompact ? 112 : 96));
  const scoreRadius = isCompact ? 60 : 66;

  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [sessions, setSessions] = useState<SleepSessionRecord[]>([]);
  const [detections, setDetections] = useState<DetectionLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadingPulse = useRef(new Animated.Value(0.35)).current;

  const refreshData = useCallback(async (softRefresh = false) => {
    if (softRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const [summaryResponse, sessionsResponse] = await Promise.all([getDashboardSummary(), listSleepSessions(12)]);
      setSummary(summaryResponse);
      setSessions(Array.isArray(sessionsResponse) ? sessionsResponse : []);

      const latestCompletedSession = (sessionsResponse || []).find((session: SleepSessionRecord) => !!session.end_time);
      if (latestCompletedSession?.session_id) {
        try {
          const logs = await listSleepDetections(latestCompletedSession.session_id, 900);
          setDetections(Array.isArray(logs) ? logs : []);
        } catch {
          setDetections([]);
        }
      } else {
        setDetections([]);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible cargar el análisis de riesgo.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData(false);
    }, [refreshData]),
  );

  React.useEffect(() => {
    if (!loading || summary) {
      loadingPulse.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(loadingPulse, { toValue: 1, duration: 520, useNativeDriver: true }),
        Animated.timing(loadingPulse, { toValue: 0.35, duration: 620, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [loading, summary, loadingPulse]);

  const latestSession = useMemo(() => sessions.find((session) => !!session.end_time) || sessions[0] || null, [sessions]);
  const summaryEvents = summary?.indicadores?.eventos_apnea_ronquido || { ronquidos: 0, apnea: 0, total: 0 };
  const apneaCount = latestSession?.apnea_events ?? summaryEvents.apnea ?? 0;
  const snoreCount = latestSession?.snore_count ?? summaryEvents.ronquidos ?? 0;
  const sleepScore = latestSession?.sleep_score ?? summary?.indicadores?.sleep_score ?? 0;

  const riskVisual = useMemo(() => riskFromApneaEvents(apneaCount), [apneaCount]);

  const continuityData = useMemo(() => {
    const fromDetections = buildTimelineFromDetections(detections, latestSession?.start_time);
    if (fromDetections.length > 1) {
      return fromDetections;
    }

    const fromSummary = buildTimelineFromSummary(summary?.indicadores?.continuidad || [], latestSession?.start_time);
    if (fromSummary.length > 1) {
      return fromSummary;
    }

    return buildFallbackTimeline();
  }, [detections, latestSession?.start_time, summary?.indicadores?.continuidad]);

  const hasData = latestSession || summary?.indicadores?.sleep_score;

  if (loading && !summary) {
    return (
      <AmbientBackdrop>
        <ScrollView contentContainerStyle={styles.container}>
          <LoadingState pulse={loadingPulse} />
          <Text style={styles.footerDisclaimer}>{DEFAULT_DISCLAIMER}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </AmbientBackdrop>
    );
  }

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <ApneaRiskBadge visual={riskVisual} size="md" />

        <GlassCard style={styles.heroCard as any}>
          <View style={[styles.heroLayout, isCompact ? styles.heroLayoutCompact : null]}>
            <View style={[styles.heroTextWrap, isCompact ? styles.heroTextWrapCompact : null]}>
              <Text style={styles.heroEyebrow}>Tu última noche</Text>
              <Text style={[styles.heroTitle, isCompact ? styles.heroTitleCompact : null]}>Análisis de apnea</Text>
              <Text style={[styles.heroSubtitle, isCompact ? styles.heroSubtitleCompact : null]}>
                {riskVisual.interpretation}
              </Text>

              <View style={[styles.riskPanel, { backgroundColor: riskVisual.softColor, borderColor: riskVisual.color }]}>
                <Text style={[styles.riskStepLabel, { color: riskVisual.color }]}>Qué hacer hoy</Text>
                <Text style={styles.riskStepText}>{riskVisual.nextStep}</Text>
              </View>
            </View>

            <View style={[styles.scoreWrap, isCompact ? styles.scoreWrapCompact : null]}>
              <CircularProgress
                value={sleepScore}
                radius={scoreRadius}
                maxValue={100}
                duration={1300}
                activeStrokeColor={riskVisual.color}
                inActiveStrokeColor="#E2E8F0"
                inActiveStrokeOpacity={1}
                activeStrokeWidth={isCompact ? 12 : 14}
                inActiveStrokeWidth={isCompact ? 12 : 14}
                progressValueColor={palette.textPrimary}
                progressValueStyle={styles.scoreValue}
                title="Calidad"
                titleStyle={styles.scoreTitle}
                subtitle={sleepScore >= 65 ? 'Aceptable' : 'A mejorar'}
                subtitleStyle={styles.scoreSubtitle}
                valueSuffix=""
              />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
            onPress={() => navigation.getParent()?.navigate('MonitorTab')}
          >
            <Text style={styles.primaryButtonText}>Monitorear esta noche</Text>
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed ? styles.buttonPressed : null]}
              onPress={() => refreshData(true)}
            >
              <Text style={styles.ghostButtonText}>Actualizar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed ? styles.buttonPressed : null]}
              onPress={() => navigation.getParent()?.navigate('HistoryTab')}
            >
              <Text style={styles.ghostButtonText}>Ver historial</Text>
            </Pressable>

            {refreshing ? <ActivityIndicator color={palette.primary} size="small" /> : null}
          </View>

          {latestSession?.analysis_label ? (
            <Text style={styles.sourceNote}>{latestSession.analysis_label}</Text>
          ) : latestSession && !latestSession.model_source ? (
            <Text style={styles.sourceNote}>
              Esta noche se registró sin análisis de audio; las métricas son estimaciones del teléfono.
            </Text>
          ) : null}
        </GlassCard>

        <View style={styles.featuresRow}>
          <View style={[styles.featureCard, isCompact ? styles.featureCardCompact : null]}>
            <Text style={styles.featureLabel}>Apneas</Text>
            <Text style={[styles.featureValue, { color: palette.danger }]}>{apneaCount}</Text>
            <Text style={styles.featureHint}>Eventos respiratorios de la noche.</Text>
          </View>

          <View style={[styles.featureCard, isCompact ? styles.featureCardCompact : null]}>
            <Text style={styles.featureLabel}>Ronquidos</Text>
            <Text style={[styles.featureValue, { color: palette.primary }]}>{snoreCount}</Text>
            <Text style={styles.featureHint}>Conteo de ronquidos registrado.</Text>
          </View>
        </View>

        <GlassCard>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>Eventos durante la noche</Text>
            <Text style={styles.sectionCaption}>
              {detections.length > 0 ? 'Última noche registrada' : 'Resumen de la última sesión'}
            </Text>
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3271F5' }]} />
              <Text style={styles.legendText}>Momento de la noche</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: palette.danger }]} />
              <Text style={styles.legendText}>Apnea / interrupción</Text>
            </View>
          </View>

          <View style={styles.chartWrap}>
            <View style={[styles.chartCanvas, { width: chartWidth }]}>
              <LineChart.Provider data={continuityData}>
                <LineChart width={chartWidth} height={180}>
                  <LineChart.Path color={palette.primary} width={3} />
                  <LineChart.Gradient color={palette.primary} />
                  <LineChart.HorizontalLine
                    at={{ value: 80 }}
                    color="rgba(220,38,38,0.4)"
                    lineProps={{ strokeDasharray: [6, 6] }}
                  />
                </LineChart>
              </LineChart.Provider>
            </View>
          </View>
        </GlassCard>

        {hasData ? (
          <GlassCard style={styles.planCard as any}>
            <Text style={styles.planEyebrow}>Recomendación</Text>
            <Text style={styles.planTitle}>{riskVisual.nextStep}</Text>
            <Text style={styles.planText}>
              La apneas moderadas y graves están asociadas a eventos de oxigenación baja durante el sueño. Si el patrón se repite,
              considera consultar a un especialista del sueño con estos registros en mano.
            </Text>
          </GlassCard>
        ) : null}

        <Text style={styles.footerDisclaimer}>{summary?.disclaimer_medico || DEFAULT_DISCLAIMER}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 14,
  },
  loadingCard: {
    borderColor: 'rgba(37,99,235,0.3)',
    backgroundColor: '#FFFFFF',
  },
  loadingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingSubtitle: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  loadingBarLarge: {
    marginTop: 14,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  loadingBarMedium: {
    marginTop: 10,
    height: 14,
    borderRadius: 8,
    backgroundColor: '#E8EDF5',
    width: '84%',
  },
  loadingBarSmall: {
    marginTop: 10,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#EEF2F8',
    width: '56%',
  },
  heroCard: {
    borderColor: 'rgba(37,99,235,0.25)',
    backgroundColor: '#FFFFFF',
  },
  heroLayout: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  heroLayoutCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 210,
    maxWidth: '58%',
  },
  heroTextWrapCompact: {
    minWidth: 0,
    maxWidth: '100%',
  },
  heroEyebrow: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTitle: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  heroTitleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  heroSubtitle: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  heroSubtitleCompact: {
    lineHeight: 19,
  },
  riskPanel: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  riskStepLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  riskStepText: {
    marginTop: 4,
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  scoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 150,
  },
  scoreWrapCompact: {
    width: '100%',
    minWidth: 0,
    marginTop: 4,
  },
  scoreValue: {
    fontFamily: fonts.heading,
    fontSize: 34,
  },
  scoreTitle: {
    fontFamily: fonts.bodyRegular,
    color: palette.textMuted,
    fontSize: 12,
  },
  scoreSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  actionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sourceNote: {
    marginTop: 12,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  ghostButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: palette.surface,
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  featuresRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  featureCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: palette.surface,
  },
  featureCardCompact: {
    width: '100%',
    flexBasis: '100%',
  },
  featureLabel: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureValue: {
    marginTop: 8,
    fontFamily: fonts.heading,
    fontSize: 36,
    color: palette.textPrimary,
  },
  featureHint: {
    marginTop: 4,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    lineHeight: 18,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 21,
  },
  sectionCaption: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  legendRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
  },
  chartWrap: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartCanvas: {
    height: 184,
  },
  planCard: {
    borderColor: 'rgba(37,99,235,0.3)',
    backgroundColor: '#FFFFFF',
  },
  planEyebrow: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  planTitle: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 22,
    lineHeight: 26,
  },
  planText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  footerDisclaimer: {
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  errorText: {
    color: palette.danger,
    fontFamily: fonts.body,
    marginBottom: 20,
  },
});
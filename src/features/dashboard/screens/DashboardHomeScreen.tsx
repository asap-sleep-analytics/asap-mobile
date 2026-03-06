// @ts-nocheck
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
import GlassCard from '../../../components/GlassCard';
import { getApiErrorMessage, getDashboardSummary, listSleepDetections, listSleepSessions } from '../../../services/api';
import { fonts, palette } from '../../../theme/tokens';
import SleepFeedbackCard from '../components/SleepFeedbackCard';

const DEFAULT_DISCLAIMER = 'A.S.A.P. no reemplaza diagnostico clinico profesional.';

function getScoreVisual(score, apneaEvents) {
  if (score >= 82 && apneaEvents <= 2) {
    return { label: 'Recuperador', color: palette.mint, subtitle: 'Descanso estable' };
  }
  if (score >= 65) {
    return { label: 'Vigilancia', color: palette.warning, subtitle: 'Ritmo intermedio' };
  }
  return { label: 'Alerta', color: palette.danger, subtitle: 'Sueno fragmentado' };
}

function resolveSessionStartMs(sessionStart, fallbackCount) {
  const parsed = Date.parse(sessionStart || '');
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Date.now() - Math.max(fallbackCount, 1) * 30 * 1000;
}

function buildTimelineFromDetections(detections = [], sessionStart = null) {
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

function buildTimelineFromSummary(continuity = [], sessionStart = null) {
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

function buildFallbackTimeline() {
  const now = Date.now();
  return Array.from({ length: 20 }).map((_, index) => ({
    timestamp: now - (20 - index) * 15 * 60 * 1000,
    value: index % 7 === 0 ? 62 : 36,
    label: index % 7 === 0 ? 'Interrupcion' : 'Normal',
  }));
}

function LoadingState({ pulse }) {
  return (
    <GlassCard style={styles.loadingCard}>
      <View style={styles.loadingHeaderRow}>
        <Text style={styles.sectionTitle}>Sincronizando con Neon</Text>
        <ActivityIndicator color={palette.mint} size="small" />
      </View>
      <Text style={styles.loadingSubtitle}>Preparando tu ultima noche procesada por ml_service...</Text>
      <Animated.View style={[styles.loadingBarLarge, { opacity: pulse }]} />
      <Animated.View style={[styles.loadingBarMedium, { opacity: pulse }]} />
      <Animated.View style={[styles.loadingBarSmall, { opacity: pulse }]} />
    </GlassCard>
  );
}

export default function DashboardHomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 390;
  const isVeryCompact = width < 350;
  const chartWidth = Math.max(170, width - (isCompact ? 112 : 96));
  const scoreRadius = isVeryCompact ? 54 : isCompact ? 60 : 66;

  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [detections, setDetections] = useState([]);

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

      const latestCompletedSession = (sessionsResponse || []).find((session) => !!session.end_time);
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
      setError(getApiErrorMessage(err, 'No fue posible cargar el dashboard.'));
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
  const scoreVisual = useMemo(() => getScoreVisual(sleepScore, apneaCount), [sleepScore, apneaCount]);

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

  const latestFinishedSessionId = latestSession?.end_time ? latestSession.session_id : null;

  if (loading && !summary) {
    return (
      <AmbientBackdrop>
        <ScrollView contentContainerStyle={styles.container}>
          <LoadingState pulse={loadingPulse} />
          <Text style={styles.footerDisclaimer}>{summary?.disclaimer_medico || DEFAULT_DISCLAIMER}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </AmbientBackdrop>
    );
  }

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <GlassCard style={styles.heroCard}>
          <View style={[styles.heroLayout, isCompact ? styles.heroLayoutCompact : null]}>
            <View style={[styles.heroTextWrap, isCompact ? styles.heroTextWrapCompact : null]}>
              <Text style={styles.heroEyebrow}>Dashboard nocturno</Text>
              <Text style={[styles.heroTitle, isCompact ? styles.heroTitleCompact : null]}>Resumen de tu última noche</Text>
              <Text style={[styles.heroSubtitle, isCompact ? styles.heroSubtitleCompact : null]}>
                Métricas reales del backend + card de feedback para reforzar el aprendizaje del modelo.
              </Text>
              <View style={styles.heroMetaRow}>
                <View style={styles.heroMetaBadge}>
                  <Text style={[styles.heroMetaText, { color: scoreVisual.color }]}>{scoreVisual.label}</Text>
                </View>
                <Text style={styles.heroMetaValue}>{scoreVisual.subtitle}</Text>
              </View>
            </View>

            <View style={[styles.scoreWrap, isCompact ? styles.scoreWrapCompact : null]}>
              <CircularProgress
                value={sleepScore}
                radius={scoreRadius}
                maxValue={100}
                duration={1300}
                activeStrokeColor={scoreVisual.color}
                inActiveStrokeColor="rgba(255,255,255,0.16)"
                inActiveStrokeOpacity={0.35}
                activeStrokeWidth={isCompact ? 12 : 14}
                inActiveStrokeWidth={isCompact ? 12 : 14}
                progressValueColor={palette.textPrimary}
                progressValueStyle={[styles.scoreValue, isCompact ? styles.scoreValueCompact : null]}
                title="Sleep Score"
                titleStyle={styles.scoreTitle}
                subtitle={scoreVisual.label}
                subtitleStyle={[styles.scoreSubtitle, { color: scoreVisual.color }]}
                valueSuffix=""
              />
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed ? styles.buttonPressed : null]}
              onPress={() => refreshData(true)}
            >
              <Text style={styles.ghostButtonText}>Actualizar</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.ghostButton, pressed ? styles.buttonPressed : null]}
              onPress={() => navigation.getParent()?.navigate('MonitorTab')}
            >
              <Text style={styles.ghostButtonText}>Ir a monitor</Text>
            </Pressable>

            {refreshing ? <ActivityIndicator color={palette.mint} size="small" /> : null}
          </View>
        </GlassCard>

        <View style={styles.featuresRow}>
          <View style={[styles.featureCard, styles.apneaCard, isCompact ? styles.featureCardCompact : null]}>
            <Text style={styles.featureLabel}>Eventos apnea</Text>
            <Text style={[styles.featureValue, styles.apneaValue]}>{apneaCount}</Text>
            <Text style={styles.featureHint}>Alertas detectadas por el pipeline de inferencia.</Text>
          </View>

          <View style={[styles.featureCard, styles.snoreCard, isCompact ? styles.featureCardCompact : null]}>
            <Text style={styles.featureLabel}>Eventos ronquido</Text>
            <Text style={[styles.featureValue, styles.snoreValue]}>{snoreCount}</Text>
            <Text style={styles.featureHint}>Conteo consolidado de la sesión finalizada.</Text>
          </View>
        </View>

        <GlassCard>
          <View style={styles.sectionHeadRow}>
            <Text style={styles.sectionTitle}>Continuidad de la noche</Text>
            <Text style={styles.sectionCaption}>
              {detections.length > 0 ? 'Fuente: sleep_detection_logs' : 'Fuente: resumen de sesión'}
            </Text>
          </View>

          <View style={styles.chartWrap}>
            <View style={[styles.chartCanvas, { width: chartWidth }]}> 
              <LineChart.Provider data={continuityData}>
                <LineChart width={chartWidth} height={180}>
                  <LineChart.Path color={palette.mint} width={3} />
                  <LineChart.Gradient color={palette.mint} />
                  <LineChart.HorizontalLine
                    at={{ value: 80 }}
                    color="rgba(255,141,141,0.42)"
                    lineProps={{ strokeDasharray: [6, 6] }}
                  />
                </LineChart>
              </LineChart.Provider>
            </View>
          </View>
        </GlassCard>

        <SleepFeedbackCard sessionId={latestFinishedSessionId} onSaved={() => refreshData(true)} />

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
    borderColor: 'rgba(110,247,207,0.32)',
    backgroundColor: 'rgba(4,14,11,0.82)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    width: '100%',
  },
  loadingBarMedium: {
    marginTop: 10,
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '84%',
  },
  loadingBarSmall: {
    marginTop: 10,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '56%',
  },
  heroCard: {
    borderColor: 'rgba(110,247,207,0.34)',
    backgroundColor: 'rgba(9,22,18,0.84)',
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
    maxWidth: '64%',
  },
  heroTextWrapCompact: {
    minWidth: 0,
    maxWidth: '100%',
  },
  heroEyebrow: {
    color: palette.mint,
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
  heroMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroMetaBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroMetaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  heroMetaValue: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
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
  scoreValueCompact: {
    fontSize: 30,
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
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  ghostButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.78,
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
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: palette.panel,
  },
  featureCardCompact: {
    width: '100%',
    flexBasis: '100%',
  },
  apneaCard: {
    borderColor: 'rgba(255,141,141,0.42)',
    backgroundColor: 'rgba(255,141,141,0.08)',
  },
  snoreCard: {
    borderColor: 'rgba(110,247,207,0.42)',
    backgroundColor: 'rgba(110,247,207,0.08)',
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
  apneaValue: {
    color: palette.danger,
  },
  snoreValue: {
    color: palette.mint,
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
  chartWrap: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(4,9,8,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: 'center',
    overflow: 'hidden',
  },
  chartCanvas: {
    height: 184,
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

// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { getApiErrorMessage, listSleepSessions } from '../../../services/api';
import { fonts, palette } from '../../../theme/tokens';

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '--';
  }

  return parsed.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) {
    return '--';
  }

  const start = Date.parse(startTime);
  const end = Date.parse(endTime);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return '--';
  }

  const totalMinutes = Math.round((end - start) / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} h ${mins} min`;
}

function toIsoDate(value) {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvReport(sessions) {
  const header = [
    'Sesion',
    'Inicio',
    'Fin',
    'Duracion',
    'Sleep Score',
    'Eventos Apnea',
    'Eventos Ronquido',
    'Ruido Ambiente dB',
    'Disclaimer',
  ];

  const rows = sessions.map((session) => [
    session.session_id || '--',
    toIsoDate(session.start_time),
    toIsoDate(session.end_time),
    formatDurationMinutes(session.start_time, session.end_time),
    session.sleep_score ?? '--',
    session.apnea_events ?? 0,
    session.snore_count ?? 0,
    session.ambient_noise_level ?? '--',
    'Documento orientativo. No es diagnostico medico.',
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildPdfHtmlReport(sessions, metrics) {
  const rows = sessions
    .map(
      (session) => `
      <tr>
        <td>${session.session_id || '--'}</td>
        <td>${toIsoDate(session.start_time)}</td>
        <td>${toIsoDate(session.end_time)}</td>
        <td>${formatDurationMinutes(session.start_time, session.end_time)}</td>
        <td>${session.sleep_score ?? '--'}</td>
        <td>${session.apnea_events ?? 0}</td>
        <td>${session.snore_count ?? 0}</td>
      </tr>`,
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; padding: 20px; color: #111827; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        h2 { margin: 22px 0 10px; font-size: 16px; }
        .muted { color: #6b7280; font-size: 12px; }
        .warn { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 10px 12px; margin: 14px 0; font-size: 12px; }
        .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 12px 0 16px; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; }
        .label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
        .value { margin-top: 6px; font-size: 20px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
        th, td { border: 1px solid #e5e7eb; text-align: left; padding: 8px; }
        th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #374151; }
      </style>
    </head>
    <body>
      <h1>A.S.A.P. - Reporte de Sueno</h1>
      <p class="muted">Generado: ${new Date().toLocaleString('es-CO')}</p>

      <div class="warn">
        Documento de orientacion para seguimiento personal. No constituye diagnostico medico ni reemplaza consulta profesional.
      </div>

      <div class="grid">
        <div class="card"><div class="label">Noches</div><div class="value">${metrics.noches}</div></div>
        <div class="card"><div class="label">Score Promedio</div><div class="value">${metrics.score}</div></div>
        <div class="card"><div class="label">Total Apnea</div><div class="value">${metrics.apnea}</div></div>
        <div class="card"><div class="label">Total Ronquido</div><div class="value">${metrics.ronquido}</div></div>
      </div>

      <h2>Detalle por sesion</h2>
      <table>
        <thead>
          <tr>
            <th>Sesion</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Duracion</th>
            <th>Score</th>
            <th>Apnea</th>
            <th>Ronquido</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

export default function HistorySessionsScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async (soft = false) => {
    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const rows = await listSleepSessions(40);
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible cargar tu historial.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh(false);
    }, [refresh]),
  );

  const completedSessions = useMemo(() => sessions.filter((session) => !!session.end_time), [sessions]);
  const activeSession = useMemo(() => sessions.find((session) => !session.end_time) || null, [sessions]);

  const totalApnea = useMemo(
    () => completedSessions.reduce((sum, session) => sum + (Number(session.apnea_events) || 0), 0),
    [completedSessions],
  );

  const totalSnore = useMemo(
    () => completedSessions.reduce((sum, session) => sum + (Number(session.snore_count) || 0), 0),
    [completedSessions],
  );

  const averageScore = useMemo(() => {
    const withScore = completedSessions.filter((session) => Number.isFinite(Number(session.sleep_score)));
    if (withScore.length === 0) {
      return '--';
    }

    const total = withScore.reduce((sum, session) => sum + Number(session.sleep_score), 0);
    return Math.round(total / withScore.length);
  }, [completedSessions]);

  const exportMetrics = useMemo(
    () => ({
      noches: completedSessions.length,
      score: averageScore,
      apnea: totalApnea,
      ronquido: totalSnore,
    }),
    [completedSessions.length, averageScore, totalApnea, totalSnore],
  );

  const handleExportCsv = async () => {
    if (completedSessions.length === 0) {
      Alert.alert('Sin datos', 'Aún no hay sesiones finalizadas para exportar.');
      return;
    }

    setExportingFormat('csv');
    try {
      const csvContent = buildCsvReport(completedSessions);
      const fileUri = `${FileSystem.cacheDirectory}asap_reporte_sueno_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Exportado', `Archivo generado en: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Exportar reporte CSV',
      });
    } catch {
      Alert.alert('Error', 'No fue posible exportar el CSV en este momento.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportPdf = async () => {
    if (completedSessions.length === 0) {
      Alert.alert('Sin datos', 'Aún no hay sesiones finalizadas para exportar.');
      return;
    }

    setExportingFormat('pdf');
    try {
      const html = buildPdfHtmlReport(completedSessions, exportMetrics);
      const { uri } = await Print.printToFileAsync({ html });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Exportado', `Archivo generado en: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Exportar reporte PDF',
      });
    } catch {
      Alert.alert('Error', 'No fue posible exportar el PDF en este momento.');
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Historial</Text>
        <Text style={styles.title}>Sesiones registradas</Text>
        <Text style={styles.subtitle}>Vista cronológica de tus noches procesadas por A.S.A.P.</Text>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Noches</Text>
              <Text style={styles.metricValue}>{completedSessions.length}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Score prom.</Text>
              <Text style={styles.metricValue}>{averageScore}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Apnea / Ronquido</Text>
              <Text style={styles.metricValue}>{`${totalApnea} / ${totalSnore}`}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => refresh(true)}
              style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.ghostButtonText}>Actualizar</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.getParent()?.navigate('MonitorTab')}
              style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.ghostButtonText}>Ir a monitor</Text>
            </Pressable>
            <Pressable
              onPress={handleExportPdf}
              style={({ pressed }) => [styles.ghostButtonBlue, pressed ? styles.pressed : null]}
            >
              <Text style={styles.ghostButtonBlueText}>{exportingFormat === 'pdf' ? 'Generando PDF...' : 'Exportar PDF'}</Text>
            </Pressable>
            <Pressable
              onPress={handleExportCsv}
              style={({ pressed }) => [styles.ghostButtonBlue, pressed ? styles.pressed : null]}
            >
              <Text style={styles.ghostButtonBlueText}>{exportingFormat === 'csv' ? 'Generando CSV...' : 'Exportar CSV'}</Text>
            </Pressable>
            {refreshing ? <ActivityIndicator color={palette.mint} /> : null}
          </View>
        </GlassCard>

        {activeSession ? (
          <GlassCard style={styles.activeCard}>
            <Text style={styles.activeTitle}>Sesión en curso</Text>
            <Text style={styles.activeValue}>{activeSession.session_id?.slice(0, 8) || '--'}</Text>
            <Text style={styles.activeHint}>Iniciada: {formatDateTime(activeSession.start_time)}</Text>
          </GlassCard>
        ) : null}

        <View style={styles.listWrap}>
          {loading ? (
            <ActivityIndicator color={palette.mint} style={styles.loader} />
          ) : completedSessions.length === 0 ? (
            <GlassCard>
              <Text style={styles.emptyText}>Todavía no hay sesiones finalizadas para mostrar.</Text>
            </GlassCard>
          ) : (
            completedSessions.map((session) => (
              <GlassCard key={session.session_id} style={styles.sessionCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sessionId}>{session.session_id?.slice(0, 8) || '--'}</Text>
                  <Text style={styles.scoreChip}>{session.sleep_score ?? '--'}</Text>
                </View>

                <Text style={styles.sessionMeta}>Inicio: {formatDateTime(session.start_time)}</Text>
                <Text style={styles.sessionMeta}>Fin: {formatDateTime(session.end_time)}</Text>
                <Text style={styles.sessionMeta}>Duración: {formatDurationMinutes(session.start_time, session.end_time)}</Text>

                <View style={styles.eventsRow}>
                  <Text style={styles.eventLabel}>Apnea: {session.apnea_events ?? 0}</Text>
                  <Text style={styles.eventLabel}>Ronquido: {session.snore_count ?? 0}</Text>
                </View>
              </GlassCard>
            ))
          )}
        </View>

        <Text style={styles.disclaimer}>Información orientativa. No sustituye criterio médico profesional.</Text>
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
  summaryCard: {
    borderColor: 'rgba(110,247,207,0.3)',
    backgroundColor: 'rgba(8,18,15,0.82)',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricValue: {
    marginTop: 6,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  ghostButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  ghostButtonBlue: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(159,176,255,0.44)',
    backgroundColor: 'rgba(159,176,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ghostButtonBlueText: {
    color: '#D1DBFF',
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.8,
  },
  activeCard: {
    borderColor: 'rgba(255,218,138,0.36)',
    backgroundColor: 'rgba(255,218,138,0.08)',
  },
  activeTitle: {
    color: palette.warning,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  activeValue: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 24,
  },
  activeHint: {
    marginTop: 4,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  listWrap: {
    gap: 10,
  },
  loader: {
    marginTop: 12,
  },
  emptyText: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  sessionCard: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionId: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  scoreChip: {
    color: palette.mint,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  sessionMeta: {
    marginTop: 5,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
  },
  eventsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  eventLabel: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  disclaimer: {
    marginTop: 8,
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: palette.danger,
    fontFamily: fonts.body,
  },
});

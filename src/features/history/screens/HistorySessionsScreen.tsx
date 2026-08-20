import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import GlassCard from "../../../components/GlassCard";
import LoadingState from "../../../components/LoadingState";
import SectionBadge from "../../../components/SectionBadge";
import { getApiErrorMessage, listSleepSessions } from "../../../services/api";
import { fonts, palette } from "../../../theme/tokens";
import type { SleepSessionRecord } from "../../../types";
import {
  formatDateTime,
  formatDurationMinutes,
  toIsoDate,
} from "../../../utils/dates";
import { riskFromApneaEvents } from "../../../utils/apneaRisk";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvReport(sessions: SleepSessionRecord[]) {
  const header = [
    "Sesion",
    "Inicio",
    "Fin",
    "Duracion",
    "Eventos Apnea",
    "Eventos Ronquido",
    "Sleep Score",
    "Ruido Ambiente dB",
    "Disclaimer",
  ];

  const rows = sessions.map((session) => [
    session.session_id || "--",
    toIsoDate(session.start_time),
    toIsoDate(session.end_time),
    formatDurationMinutes(session.start_time, session.end_time),
    session.apnea_events ?? 0,
    session.snore_count ?? 0,
    session.sleep_score ?? "--",
    session.ambient_noise_level ?? "--",
    "Documento orientativo. No es diagnostico medico.",
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}

function buildPdfHtmlReport(
  sessions: SleepSessionRecord[],
  metrics: SessionMetrics,
) {
  const rows = sessions
    .map(
      (session) => `
      <tr>
        <td>${toIsoDate(session.start_time)}</td>
        <td>${formatDurationMinutes(session.start_time, session.end_time)}</td>
        <td>${session.apnea_events ?? 0}</td>
        <td>${session.snore_count ?? 0}</td>
        <td>${session.sleep_score ?? "--"}</td>
      </tr>`,
    )
    .join("");

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
      <h1>A.S.A.P. - Reporte de Apneas</h1>
      <p class="muted">Generado: ${new Date().toLocaleString("es-CO")}</p>

      <div class="warn">
        Documento de orientacion para seguimiento personal. No constituye diagnostico medico ni reemplaza consulta profesional.
      </div>

      <div class="grid">
        <div class="card"><div class="label">Noches</div><div class="value">${metrics.noches}</div></div>
        <div class="card"><div class="label">Promedio Apneas/Noche</div><div class="value">${metrics.promedioApnea}</div></div>
        <div class="card"><div class="label">Total Apnea</div><div class="value">${metrics.apnea}</div></div>
        <div class="card"><div class="label">Total Ronquido</div><div class="value">${metrics.ronquido}</div></div>
      </div>

      <h2>Detalle por sesion</h2>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Duracion</th>
            <th>Apnea</th>
            <th>Ronquido</th>
            <th>Puntaje</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>`;
}

interface SessionMetrics {
  noches: number;
  promedioApnea: number | string;
  apnea: number;
  ronquido: number;
}

export default function HistorySessionsScreen({
  navigation,
}: {
  navigation: any;
}) {
  const [sessions, setSessions] = useState<SleepSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(
    null,
  );
  const [error, setError] = useState("");

  const refresh = useCallback(async (soft = false) => {
    if (soft) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const rows = await listSleepSessions(40);
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(getApiErrorMessage(err, "No fue posible cargar tu historial."));
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

  const completedSessions = useMemo(
    () => sessions.filter((session) => !!session.end_time),
    [sessions],
  );
  const activeSession = useMemo(
    () => sessions.find((session) => !session.end_time) || null,
    [sessions],
  );

  const totalApnea = useMemo(
    () =>
      completedSessions.reduce(
        (sum, session) => sum + (Number(session.apnea_events) || 0),
        0,
      ),
    [completedSessions],
  );

  const totalSnore = useMemo(
    () =>
      completedSessions.reduce(
        (sum, session) => sum + (Number(session.snore_count) || 0),
        0,
      ),
    [completedSessions],
  );

  const averageApneaPerNight = useMemo(() => {
    if (completedSessions.length === 0) {
      return "--";
    }
    return (totalApnea / completedSessions.length).toFixed(1);
  }, [completedSessions.length, totalApnea]);

  const latestRisk = useMemo(() => {
    const latest = completedSessions[0] || null;
    return latest ? riskFromApneaEvents(latest.apnea_events ?? 0) : null;
  }, [completedSessions]);

  const exportMetrics = useMemo(
    () => ({
      noches: completedSessions.length,
      promedioApnea: averageApneaPerNight,
      apnea: totalApnea,
      ronquido: totalSnore,
    }),
    [completedSessions.length, averageApneaPerNight, totalApnea, totalSnore],
  );

  const handleExportCsv = async () => {
    if (completedSessions.length === 0) {
      Alert.alert(
        "Sin datos",
        "Aún no hay sesiones finalizadas para exportar.",
      );
      return;
    }

    setExportingFormat("csv");
    try {
      const csvContent = buildCsvReport(completedSessions);
      const fileUri = `${FileSystem.cacheDirectory}asap_reporte_apneas_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Exportado", `Archivo generado en: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Exportar reporte CSV",
      });
    } catch {
      Alert.alert("Error", "No fue posible exportar el CSV en este momento.");
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportPdf = async () => {
    if (completedSessions.length === 0) {
      Alert.alert(
        "Sin datos",
        "Aún no hay sesiones finalizadas para exportar.",
      );
      return;
    }

    setExportingFormat("pdf");
    try {
      const html = buildPdfHtmlReport(completedSessions, exportMetrics);
      const { uri } = await Print.printToFileAsync({ html });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Exportado", `Archivo generado en: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Exportar reporte PDF",
      });
    } catch {
      Alert.alert("Error", "No fue posible exportar el PDF en este momento.");
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionBadge label="Historial de apneas" />
        <Text style={styles.title}>Tus noches monitoreadas</Text>
        <Text style={styles.subtitle}>
          Revisa la evolución de tus eventos de apnea y ronquido noche a noche.
        </Text>

        <GlassCard style={styles.summaryCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Noches</Text>
              <Text style={styles.metricValue}>{completedSessions.length}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Prom. apneas/noche</Text>
              <Text style={styles.metricValue}>{averageApneaPerNight}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Apnea / Ronquido</Text>
              <Text
                style={styles.metricValue}
              >{`${totalApnea} / ${totalSnore}`}</Text>
            </View>
          </View>

          {latestRisk ? (
            <View style={styles.latestRiskRow}>
              <Text style={styles.latestRiskLabel}>Última noche</Text>
              <View
                style={[
                  styles.latestRiskBadge,
                  {
                    backgroundColor: latestRisk.softColor,
                    borderColor: latestRisk.color,
                  },
                ]}
              >
                <View
                  style={[
                    styles.riskDot,
                    { backgroundColor: latestRisk.color },
                  ]}
                />
                <Text
                  style={[styles.latestRiskText, { color: latestRisk.color }]}
                >
                  {latestRisk.label}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => refresh(true)}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ghostButtonText}>Actualizar</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.getParent()?.navigate("MonitorTab")}
              style={({ pressed }) => [
                styles.ghostButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ghostButtonText}>Ir a monitorear</Text>
            </Pressable>
            <Pressable
              onPress={handleExportPdf}
              style={({ pressed }) => [
                styles.ghostButtonBlue,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ghostButtonBlueText}>
                {exportingFormat === "pdf" ? "Generando..." : "Exportar PDF"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleExportCsv}
              style={({ pressed }) => [
                styles.ghostButtonBlue,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.ghostButtonBlueText}>
                {exportingFormat === "csv" ? "Generando..." : "Exportar CSV"}
              </Text>
            </Pressable>
            {refreshing ? <ActivityIndicator color={palette.primary} /> : null}
          </View>
        </GlassCard>

        {activeSession ? (
          <GlassCard style={styles.activeCard}>
            <Text style={styles.activeTitle}>Sesión en curso</Text>
            <Text style={styles.activeValue}>Monitoreo activo</Text>
            <Text style={styles.activeHint}>
              Iniciada: {formatDateTime(activeSession.start_time)}
            </Text>
          </GlassCard>
        ) : null}

        <View style={styles.listWrap}>
          {loading ? (
            <LoadingState message="Cargando tu historial..." />
          ) : completedSessions.length === 0 ? (
            <GlassCard>
              <Text style={styles.emptyText}>
                Aún no hay noches finalizadas para mostrar. Inicia tu primer
                monitoreo.
              </Text>
            </GlassCard>
          ) : (
            completedSessions.map((session) => {
              const sessionRisk = riskFromApneaEvents(
                session.apnea_events ?? 0,
              );
              return (
                <GlassCard key={session.session_id} style={styles.sessionCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.sessionDate}>
                      {formatDateTime(session.start_time)}
                    </Text>
                    <Text
                      style={[styles.scoreChip, { color: sessionRisk.color }]}
                    >
                      {session.sleep_score ?? "--"}
                    </Text>
                  </View>

                  <View style={styles.eventsRow}>
                    <View
                      style={[
                        styles.eventChip,
                        {
                          backgroundColor: sessionRisk.softColor,
                          borderColor: sessionRisk.color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.eventChipValue,
                          { color: sessionRisk.color },
                        ]}
                      >
                        {session.apnea_events ?? 0}
                      </Text>
                      <Text style={styles.eventChipLabel}>apneas</Text>
                    </View>
                    <View
                      style={[
                        styles.eventChip,
                        {
                          backgroundColor: palette.panelStrong,
                          borderColor: palette.borderSoft,
                        },
                      ]}
                    >
                      <Text style={styles.eventChipValueAlt}>
                        {session.snore_count ?? 0}
                      </Text>
                      <Text style={styles.eventChipLabel}>ronquidos</Text>
                    </View>
                    <View
                      style={[
                        styles.eventChip,
                        {
                          backgroundColor: palette.panelStrong,
                          borderColor: palette.borderSoft,
                        },
                      ]}
                    >
                      <Text style={styles.eventChipValueAlt}>
                        {formatDurationMinutes(
                          session.start_time,
                          session.end_time,
                        )}
                      </Text>
                      <Text style={styles.eventChipLabel}>duración</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </View>

        <Text style={styles.disclaimer}>
          Información orientativa. No sustituye criterio médico profesional.
        </Text>
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
    borderColor: "rgba(37,99,235,0.28)",
    backgroundColor: palette.surface,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  metricCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  metricLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  metricValue: {
    marginTop: 6,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  latestRiskRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  latestRiskLabel: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  latestRiskBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  latestRiskText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  ghostButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
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
    borderColor: "rgba(37,99,235,0.4)",
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ghostButtonBlueText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.8,
  },
  activeCard: {
    borderColor: "rgba(217,119,6,0.4)",
    backgroundColor: palette.warningSoft,
  },
  activeTitle: {
    color: palette.warning,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
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
  emptyText: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  sessionCard: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sessionDate: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  scoreChip: {
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  eventsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  eventChip: {
    flex: 1,
    minWidth: 96,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  eventChipValue: {
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  eventChipValueAlt: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: palette.textPrimary,
  },
  eventChipLabel: {
    marginTop: 2,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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

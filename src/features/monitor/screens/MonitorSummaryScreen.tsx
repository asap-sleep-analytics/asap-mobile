import React, { useContext } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import AppButton from "../../../components/AppButton";
import GlassCard from "../../../components/GlassCard";
import MetricCard from "../../../components/MetricCard";
import SectionBadge from "../../../components/SectionBadge";
import { AppContext } from "../../../context/AppContext";
import { fonts, palette } from "../../../theme/tokens";
import type { SleepSessionRecord } from "../../../types";
import { formatDurationMinutes } from "../../../utils/dates";
import { riskFromApneaEvents } from "../../../utils/apneaRisk";

interface Props {
  route: { params?: { session?: SleepSessionRecord | null } };
  navigation: {
    goBack: () => void;
    getParent: () => { navigate: (screen: string) => void } | undefined;
  };
}

export default function MonitorSummaryScreen({ route, navigation }: Props) {
  const { setActiveSleepSessionId } = useContext(AppContext);
  const session = route?.params?.session || null;

  const apnea = session?.apnea_events ?? 0;
  const snore = session?.snore_count ?? 0;
  const score = session?.sleep_score ?? 0;
  const riskVisual = riskFromApneaEvents(apnea);

  const handleGoToHistory = () => {
    setActiveSleepSessionId("");
    navigation.getParent()?.navigate("HistoryTab");
  };

  const handleBackToMonitor = () => {
    setActiveSleepSessionId("");
    navigation.goBack();
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionBadge label="Monitoreo finalizado" />
        <Text style={styles.title}>Resultado de tu noche</Text>
        <Text style={styles.subtitle}>
          Esto es lo que registramos en cuanto a eventos respiratorios durante
          esta sesión.
        </Text>

        <GlassCard
          style={[
            styles.riskCard,
            {
              backgroundColor: riskVisual.softColor,
              borderColor: riskVisual.color,
            },
          ]}
        >
          <Text style={[styles.riskLabel, { color: riskVisual.color }]}>
            Nivel de riesgo de apnea
          </Text>
          <Text style={[styles.riskTitle, { color: riskVisual.color }]}>
            {riskVisual.label}
          </Text>
          <Text style={styles.riskMessage}>{riskVisual.interpretation}</Text>
          <View
            style={[styles.nextPanel, { backgroundColor: palette.surface }]}
          >
            <Text style={styles.nextLabel}>Recomendación</Text>
            <Text style={styles.nextText}>{riskVisual.nextStep}</Text>
          </View>
        </GlassCard>

        <View style={styles.metricRow}>
          <MetricCard
            label="Apneas"
            value={String(apnea)}
            valueColor={apnea > 0 ? palette.danger : palette.success}
          />
          <MetricCard label="Ronquidos" value={String(snore)} />
          <MetricCard label="Calidad" value={String(score)} />
        </View>

        <View style={styles.metricRow}>
          <MetricCard
            label="Duración"
            value={formatDurationMinutes(
              session?.start_time,
              session?.end_time,
            )}
          />
          <MetricCard
            label="Sesión"
            value={session?.end_time ? "Cerrada" : "Sin cerrar"}
            valueColor={palette.primary}
          />
        </View>

        {session?.analysis_label ? (
          <Text style={styles.sourceNote}>{session.analysis_label}</Text>
        ) : session?.model_source === null ? (
          <Text style={styles.sourceNote}>
            Esta sesión no pudo analizarse con audio; las métricas son
            estimaciones locales del teléfono.
          </Text>
        ) : null}

        <GlassCard style={styles.actionsCard}>
          <Text style={styles.actionsHint}>
            Puedes ver el detalle completo y exportar tu reporte desde el
            historial.
          </Text>
          <AppButton
            label="Ver mi historial"
            onPress={handleGoToHistory}
            style={styles.primaryButton}
          />
          <AppButton
            label="Volver al monitor"
            onPress={handleBackToMonitor}
            variant="ghost"
            style={styles.ghostButton}
          />
        </GlassCard>

        <Text style={styles.disclaimer}>
          Información orientativa. No sustituye un diagnóstico médico
          profesional.
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
  riskCard: {
    paddingVertical: 18,
  },
  riskLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  riskTitle: {
    marginTop: 8,
    fontFamily: fonts.heading,
    fontSize: 36,
    lineHeight: 40,
  },
  riskMessage: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  nextPanel: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nextLabel: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  nextText: {
    marginTop: 4,
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  metricRow: {
    flexDirection: "row",
    gap: 8,
  },
  sourceNote: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  actionsCard: {
    borderColor: "rgba(37,99,235,0.3)",
    backgroundColor: palette.surface,
  },
  actionsHint: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 19,
    marginBottom: 12,
  },
  primaryButton: {
    width: "100%",
  },
  ghostButton: {
    marginTop: 8,
    width: "100%",
  },
  disclaimer: {
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});

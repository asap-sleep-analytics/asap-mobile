import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import GlassCard from "../../../components/GlassCard";
import SectionBadge from "../../../components/SectionBadge";
import { fonts, palette } from "../../../theme/tokens";

const SUPPORT_EMAIL = "soporte@asap-health.app";

export default function ContactSupportScreen() {
  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionBadge label="Soporte" />
        <Text style={styles.title}>Contacto y soporte</Text>
        <Text style={styles.subtitle}>
          ¿Tienes dudas sobre tus resultados, tu cuenta o el monitoreo?
          Escríbenos.
        </Text>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Correo de soporte</Text>
          <Text style={styles.email}>{SUPPORT_EMAIL}</Text>
          <Text style={styles.cardBody}>
            Respondemos en horario hábil. Incluye tu correo registrado y una
            breve descripción del caso (adjunta capturas si aplica) para
            ayudarte más rápido.
          </Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Derechos de datos</Text>
          <Text style={styles.cardBody}>
            Para ejercer tus derechos de conocer, actualizar o eliminar tus
            datos personales bajo la Ley 1581 de 2012, usa el mismo correo e
            indica el motivo en el asunto. Te responderemos dentro de los plazos
            legales.
          </Text>
        </GlassCard>

        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Reportar un problema técnico</Text>
          <Text style={styles.cardBody}>
            Describe qué hacías cuando ocurrió el error, en qué modelo de
            celular y con qué versión de la app. Esto acelera la corrección y la
            mejora de A.S.A.P.
          </Text>
        </GlassCard>

        <Text style={styles.footer}>
          A.S.A.P. — Apnea Sleep Analytics Platform · v1.0
        </Text>
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 14,
  },
  title: {
    marginTop: 2,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  cardTitle: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  cardBody: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    lineHeight: 21,
  },
  email: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    marginBottom: 8,
  },
  footer: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});

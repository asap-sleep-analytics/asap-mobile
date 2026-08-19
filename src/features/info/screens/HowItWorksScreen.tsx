import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import GlassCard from "../../../components/GlassCard";
import SectionBadge from "../../../components/SectionBadge";
import { fonts, palette } from "../../../theme/tokens";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{children}</Text>
    </GlassCard>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.cardBody}>{children}</Text>
    </View>
  );
}

export default function HowItWorksScreen() {
  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionBadge label="Transparencia" />
        <Text style={styles.title}>Así mide A.S.A.P.</Text>
        <Text style={styles.subtitle}>
          Explicamos en lenguaje sencillo qué medimos, cómo lo calculamos y qué
          significan tus resultados.
        </Text>

        <Section title="¿Cómo se mide tu respiración?">
          A.S.A.P. usa el micrófono del celular para capturar fragmentos cortos
          de audio (cada 30 segundos) mientras duermes. No se graba toda la
          noche de forma continua: son muestras breves que luego se analizan.
        </Section>

        <Section title="¿Cómo se detectan las apneas?">
          Cada fragmento se envía a un modelo de análisis (v3) que combina el
          audio capturado con datos de oxigenación. El modelo estima si hubo una
          pausa respiratoria (apnea), un ronquido o una respiración normal, y
          devuelve una predicción con una certeza asociada.
        </Section>

        <Section title="¿Qué es una apnea?">
          Es una pausa en la respiración durante el sueño. A.S.A.P. las cuenta y
          las clasifica según su frecuencia:
          <Bullet>Sin eventos: no se registraron apneas.</Bullet>
          <Bullet>Riesgo bajo: de 1 a 2 apneas en la noche.</Bullet>
          <Bullet>Riesgo moderado: de 3 a 5 apneas.</Bullet>
          <Bullet>Riesgo alto: de 6 a 9 apneas.</Bullet>
          <Bullet>Riesgo crítico: 10 o más apneas en la noche.</Bullet>
        </Section>

        <Section title="¿Qué significa el puntaje y la certeza?">
          El Sleep Score resume la calidad de la noche del 0 al 100: combina
          duración, apneas, ronquidos y continuidad del sueño. La certeza (%)
          indica qué tan seguro está el modelo de la última predicción: un
          porcentaje alto significa mayor confianza en ese resultado.
        </Section>

        <Section title="Sobre el SpO2 (oxigenación)">
          El valor de SpO2 que ves durante el monitoreo es una estimación de
          referencia (beta). Mientras integramos por completo la lectura del
          oxímetro por Bluetooth, estos valores son próximos y no deben usarse
          como medición médica de oxigenación.
        </Section>

        <Section title="Recomendaciones para una buena medición">
          <Bullet>
            Coloca el teléfono cerca de la cama y con batería suficiente.
          </Bullet>
          <Bullet>
            Evita cubrir el micrófono y reduce los ruidos fuertes.
          </Bullet>
          <Bullet>
            Calibra el ruido ambiente en Preparación antes de empezar.
          </Bullet>
          <Bullet>
            Duerme en una posición habitual: eso da mediciones más
            representativas.
          </Bullet>
        </Section>

        <Section title="Importante">
          A.S.A.P. no reemplaza el diagnóstico de un profesional de la salud. Si
          el patrón de apneas se repite, conversa estos reportes con tu médico.
          Los resultados se guardan en tu dispositivo y se usan solo para tu
          análisis, sin venderlos ni compartirlos.
        </Section>

        <Text style={styles.footer}>
          A.S.A.P. — Apnea Sleep Analytics Platform
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
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingLeft: 2,
  },
  bulletDot: {
    marginTop: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.primary,
  },
  footer: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});

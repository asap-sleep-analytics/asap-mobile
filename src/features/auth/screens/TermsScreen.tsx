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

export default function TermsScreen() {
  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionBadge label="Legal" />
        <Text style={styles.title}>Términos y condiciones</Text>
        <Text style={styles.subtitle}>
          Al usar A.S.A.P. aceptas estos términos. Léelos con calma antes de
          crear tu cuenta.
        </Text>

        <Section title="1. Uso de la aplicación">
          A.S.A.P. es una herramienta de apoyo para la detección de apnea del
          sueño. La app registra y analiza sonidos de tu respiración y, si
          conectas un oxímetro, tu saturación de oxígeno, para darte una
          estimación de tu riesgo. No es un dispositivo médico ni sustituye el
          diagnóstico de un profesional de la salud.
        </Section>

        <Section title="2. Tu responsabilidad">
          Eres responsable de usar la app en un entorno que respete tu
          privacidad y la de quienes te rodean. Si tienes síntomas de apnea o
          cualquier preocupación clínica, consulta a un médico. Ante una
          emergencia, llama a tu línea local de emergencias.
        </Section>

        <Section title="3. Cuenta y contraseña">
          Debes mantener confidenciales tu correo y tu contraseña. Si sospechas
          que alguien accedió a tu cuenta, cambia tu contraseña y contacta a
          soporte@asap-health.app.
        </Section>

        <Section title="4. Tratamiento de datos">
          Tus datos personales y de salud se tratan conforme a nuestra Política
          de privacidad y a la Ley 1581 de 2012. Puedes solicitar conocer,
          actualizar o eliminar tus datos cuando quieras. Al crear tu cuenta
          aceptas el consentimiento informado para el tratamiento de esos datos.
        </Section>

        <Section title="5. Disponibilidad del servicio">
          Hacemos nuestro mejor esfuerzo por mantener el servicio disponible,
          pero no podemos garantizar que funcione de forma ininterrumpida. El
          servicio puede cambiar o suspenderse con aviso razonable.
        </Section>

        <Section title="6. Cambios a estos términos">
          Podemos actualizar estos términos. Si los cambios son importantes, te
          lo avisaremos dentro de la app. El uso continuado del servicio tras
          los cambios implica su aceptación.
        </Section>

        <Section title="7. Contacto">
          Para dudas sobre estos términos o tus datos, escríbenos a
          soporte@asap-health.app.
        </Section>

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
  footer: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});

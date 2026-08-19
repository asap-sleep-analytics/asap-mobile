import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import SectionBadge from '../../../components/SectionBadge';
import { fonts, palette } from '../../../theme/tokens';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{children}</Text>
    </GlassCard>
  );
}

export default function PrivacyPolicyScreen() {
  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionBadge label="Privacidad" />
        <Text style={styles.title}>Política de privacidad</Text>
        <Text style={styles.subtitle}>
          A.S.A.P. trata tus datos personales y de salud como información sensible. Esto es lo que hacemos con ellos.
        </Text>

        <Section title="Qué datos tratamos">
          Tu cuenta (nombre y correo), los resultados de tus sesiones de monitoreo, la encuesta de salud que decides
          completar y tus preferencias dentro de la app. Nunca pedimos más información de la necesaria.
        </Section>

        <Section title="Cómo los usamos">
          Usamos tus datos exclusivamente para calcular tu análisis de apnea, mostrarte tu historial y mejorar
          nuestras recomendaciones. No se usan para publicidad ni se venden a terceros.
        </Section>

        <Section title="Dónde se guardan">
          Las sesiones y métricas de salud se almacenan en servidores seguros. Tu encuesta y preferencias locales
          viven en tu propio dispositivo con cifrado. Tus contactos de emergencia solo se usan si activas las alertas.
        </Section>

        <Section title="Tu derecho (Ley 1581 de 2012)">
          Bajo la Ley 1581 de 2012 de la República de Colombia, puedes conocer, actualizar y solicitar la eliminación
          de tus datos personales en cualquier momento. Para ejercerlo, escríbenos a soporte@asap-health.app.
        </Section>

        <Section title="Compartición limitada">
          A.S.A.P. no comparte tu información de salud con aseguradoras, empleadores ni terceros. Solo autoridades
          cuando la ley lo exija.
        </Section>

        <Section title="Seguridad">
          Aplicamos cifrado en tránsito y en reposo, autenticación segura y accesos restringidos. Si detectamos un
          incidente de seguridad, te lo comunicaremos oportunamente.
        </Section>

        <Text style={styles.footer}>A.S.A.P. — Apnea Sleep Analytics Platform · v1.0</Text>
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
    textTransform: 'uppercase',
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
    textAlign: 'center',
    marginTop: 4,
  },
});
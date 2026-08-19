import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { fonts, palette } from '../../../theme/tokens';
import { TIPS_MODULES } from '../tipsContent';
import type { TipsProgress } from '../../../types';
import { getTipsProgress } from '../../../services/localHealth';

export default function TipsHomeScreen({ navigation }: { navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void } }) {
  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Prevención</Text>
        <Text style={styles.title}>Centro de prevención de apnea</Text>
        <Text style={styles.subtitle}>
          Guía práctica y fuentes en español, con foco en reducir el riesgo de apnea durante el sueño.
        </Text>

        {TIPS_MODULES.map((module) => (
          <Pressable key={module.id} onPress={() => navigation.navigate('TipsDetail', { moduleId: module.id })}>
            {({ pressed }) => (
              <GlassCard style={[styles.moduleCard, pressed ? styles.pressed : null]}>
                <View style={styles.moduleTopRow}>
                  <Text style={[styles.moduleAccent, { color: module.accent }]}>Módulo</Text>
                  <Text style={styles.moduleChevron}>Ver</Text>
                </View>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
              </GlassCard>
            )}
          </Pressable>
        ))}

        <GlassCard style={styles.helperCard}>
          <Text style={styles.helperTitle}>¿Cómo usar esta sección?</Text>
          <View style={styles.helperRows}>
            <Text style={styles.helperBullet}>1. Elige un módulo según tu situación actual.</Text>
            <Text style={styles.helperBullet}>2. Marca acciones completadas en el checklist.</Text>
            <Text style={styles.helperBullet}>3. Revisa fuentes oficiales para ampliar información.</Text>
          </View>
        </GlassCard>
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
    borderColor: 'rgba(37,99,235,0.35)',
    backgroundColor: palette.primarySoft,
    color: palette.primary,
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
  moduleCard: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  moduleTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleAccent: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  moduleChevron: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  moduleTitle: {
    marginTop: 7,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 23,
  },
  moduleSubtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  helperCard: {
    borderColor: 'rgba(37,99,235,0.3)',
    backgroundColor: palette.surface,
  },
  helperTitle: {
    color: palette.primary,
    fontFamily: fonts.headingMedium,
    fontSize: 22,
  },
  helperRows: {
    marginTop: 8,
    gap: 6,
  },
  helperBullet: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.84,
  },
});

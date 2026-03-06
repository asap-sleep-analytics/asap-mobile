// @ts-nocheck
import React, { useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import { AppContext } from '../../../context/AppContext';
import { fonts, palette } from '../../../theme/tokens';

function normalizeRisk(value) {
  if (typeof value !== 'string') {
    return 'Sin clasificar';
  }

  if (value.trim().length === 0) {
    return 'Sin clasificar';
  }

  return value;
}

function boolLabel(value) {
  if (value === true) {
    return 'Sí';
  }
  if (value === false) {
    return 'No';
  }
  return '--';
}

export default function ProfileHomeScreen({ navigation }) {
  const { user, signOut } = useContext(AppContext);
  const [closingSession, setClosingSession] = useState(false);
  const [error, setError] = useState('');

  const fullName = useMemo(() => user?.nombre_completo || user?.full_name || 'Paciente A.S.A.P.', [user]);
  const email = useMemo(() => user?.email || '--', [user]);
  const apneaRisk = useMemo(() => normalizeRisk(user?.riesgo_apnea_predicho || user?.apnea_risk), [user]);

  const handleSignOut = async () => {
    setClosingSession(true);
    setError('');

    try {
      await signOut();
    } catch {
      setError('No fue posible cerrar sesión en este momento.');
    } finally {
      setClosingSession(false);
    }
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Perfil</Text>
        <Text style={styles.title}>Cuenta y ajustes</Text>
        <Text style={styles.subtitle}>Preferencias clínicas y estado de autenticación segura.</Text>

        <GlassCard style={styles.profileCard}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Riesgo predicho</Text>
              <Text style={styles.infoValue}>{apneaRisk}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ronca habitualmente</Text>
              <Text style={styles.infoValue}>{boolLabel(user?.ronca_habitualmente)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Cansancio diurno</Text>
              <Text style={styles.infoValue}>{boolLabel(user?.cansancio_diurno)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Consentimiento datos</Text>
              <Text style={styles.infoValue}>{boolLabel(user?.acepta_consentimiento_datos)}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => navigation.getParent()?.navigate('HistoryTab')}
            style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.ghostButtonText}>Ver historial completo</Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            disabled={closingSession}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed ? styles.pressed : null,
              closingSession ? styles.disabled : null,
            ]}
          >
            {closingSession ? <ActivityIndicator color="#180404" /> : <Text style={styles.signOutText}>Cerrar sesión</Text>}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </GlassCard>

        <GlassCard>
          <Text style={styles.legalTitle}>Aviso médico</Text>
          <Text style={styles.legalText}>
            A.S.A.P. es una herramienta de apoyo para monitoreo del sueño y no reemplaza diagnóstico ni tratamiento médico profesional.
          </Text>
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
    borderColor: 'rgba(110,247,207,0.35)',
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
  profileCard: {
    borderColor: 'rgba(110,247,207,0.3)',
    backgroundColor: 'rgba(8,18,15,0.82)',
  },
  name: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 28,
    lineHeight: 32,
  },
  email: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  infoGrid: {
    marginTop: 14,
    gap: 8,
  },
  infoItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  infoValue: {
    marginTop: 5,
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  ghostButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    paddingVertical: 11,
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  signOutButton: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: palette.danger,
    alignItems: 'center',
    paddingVertical: 12,
  },
  signOutText: {
    color: '#180404',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.62,
  },
  errorText: {
    marginTop: 10,
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    lineHeight: 18,
  },
  legalTitle: {
    color: palette.warning,
    fontFamily: fonts.bodyBold,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontSize: 11,
  },
  legalText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
});

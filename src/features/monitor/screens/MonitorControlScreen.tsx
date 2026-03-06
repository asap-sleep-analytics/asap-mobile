// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppContext } from '../../../context/AppContext';
import { getApiErrorMessage, listSleepSessions, startSleepSession } from '../../../services/api';
import { fonts, palette } from '../../../theme/tokens';

function toNumberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function MonitorControlScreen({ navigation }) {
  const { activeSleepSessionId, setActiveSleepSessionId } = useContext(AppContext);

  const [sessions, setSessions] = useState([]);
  const [ambientNoise, setAmbientNoise] = useState('45');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listSleepSessions(12);
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible cargar tus sesiones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSessions();
    }, [refreshSessions]),
  );

  const openSession = useMemo(() => {
    if (activeSleepSessionId) {
      return sessions.find((session) => session.session_id === activeSleepSessionId) || { session_id: activeSleepSessionId };
    }
    return sessions.find((session) => !session.end_time) || null;
  }, [activeSleepSessionId, sessions]);

  const latestFinished = useMemo(() => sessions.find((session) => !!session.end_time) || null, [sessions]);

  const handleStartOrContinue = async () => {
    setError('');
    const ambientNoiseLevel = toNumberOrUndefined(ambientNoise);

    if (openSession?.session_id) {
      navigation.navigate('MonitorActive', {
        sessionId: openSession.session_id,
        ambientNoiseLevel,
      });
      return;
    }

    setWorking(true);
    try {
      const payload = ambientNoiseLevel === undefined ? {} : { ambient_noise_level: ambientNoiseLevel };
      const response = await startSleepSession(payload);
      const sessionId = response.sesion.session_id;
      setActiveSleepSessionId(sessionId);
      navigation.navigate('MonitorActive', { sessionId, ambientNoiseLevel });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible iniciar el monitoreo.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.badge}>Monitor Center</Text>
      <Text style={styles.title}>Monitoreo nocturno</Text>
      <Text style={styles.subtitle}>Centro de control absoluto para iniciar o retomar grabaciones.</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Sesión activa</Text>
          <Text style={styles.metricValue}>{openSession ? 'Sí' : 'No'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Score último</Text>
          <Text style={styles.metricValue}>{latestFinished?.sleep_score ?? '--'}</Text>
        </View>
      </View>

      <Text style={styles.label}>Ruido ambiente objetivo (dB)</Text>
      <TextInput
        value={ambientNoise}
        onChangeText={setAmbientNoise}
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="45"
        placeholderTextColor={palette.textMuted}
      />

      <Pressable
        onPress={handleStartOrContinue}
        disabled={working}
        style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, working ? styles.disabled : null]}
      >
        {working ? (
          <ActivityIndicator color="#03110C" />
        ) : (
          <Text style={styles.primaryButtonText}>{openSession ? 'Continuar monitoreo' : 'Iniciar monitoreo'}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={refreshSessions}
        style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.ghostButtonText}>Actualizar estado</Text>
      </Pressable>

      {loading ? <ActivityIndicator color={palette.mint} style={styles.loader} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'rgba(110,247,207,0.1)',
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  title: {
    marginTop: 14,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  metricGrid: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  metricLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    marginTop: 6,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 28,
  },
  label: {
    marginTop: 18,
    marginBottom: 6,
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  ghostButton: {
    marginTop: 10,
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
    fontSize: 14,
  },
  loader: {
    marginTop: 12,
  },
  errorText: {
    marginTop: 12,
    color: palette.danger,
    fontFamily: fonts.body,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.65,
  },
});

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppContext } from '../context/AppContext';
import {
  calibrateSleep,
  finishSleepSession,
  getApiErrorMessage,
  getDashboardSummary,
  listSleepSessions,
  startSleepSession,
} from '../services/api';

function toNumberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function DashboardScreen({ navigation }) {
  const { user, signOut, activeSleepSessionId, setActiveSleepSessionId } = useContext(AppContext);

  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [calibrationNoise, setCalibrationNoise] = useState('45');
  const [calibrationMessage, setCalibrationMessage] = useState('');
  const [snoreCount, setSnoreCount] = useState('20');
  const [apneaEvents, setApneaEvents] = useState('2');
  const [avgOxygen, setAvgOxygen] = useState('95');
  const [finishNoise, setFinishNoise] = useState('48');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openSessionId = useMemo(() => {
    if (activeSleepSessionId) {
      return activeSleepSessionId;
    }
    const openSession = sessions.find((session) => !session.end_time);
    return openSession?.session_id || '';
  }, [activeSleepSessionId, sessions]);

  const refreshData = async () => {
    setLoading(true);
    setError('');

    try {
      const [summaryResponse, sessionsResponse] = await Promise.all([
        getDashboardSummary(),
        listSleepSessions(10),
      ]);
      setSummary(summaryResponse);
      setSessions(sessionsResponse);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible cargar el dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleCalibrate = async () => {
    setError('');
    setCalibrationMessage('');

    try {
      const ambientNoiseLevel = Number(calibrationNoise);
      const response = await calibrateSleep(ambientNoiseLevel);
      setCalibrationMessage(`${response.nivel_ruido}: ${response.recomendacion}`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible calibrar el ruido ambiente.'));
    }
  };

  const handleStartMonitoring = async () => {
    setError('');

    try {
      const ambientNoiseLevel = toNumberOrUndefined(calibrationNoise);
      const payload = ambientNoiseLevel === undefined ? {} : { ambient_noise_level: ambientNoiseLevel };
      const response = await startSleepSession(payload);
      setActiveSleepSessionId(response.sesion.session_id);
      await refreshData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible iniciar el monitoreo.'));
    }
  };

  const handleFinishMonitoring = async () => {
    if (!openSessionId) {
      setError('No hay una sesion activa para finalizar.');
      return;
    }

    setError('');

    try {
      await finishSleepSession(openSessionId, {
        snore_count: Number(snoreCount) || 0,
        apnea_events: Number(apneaEvents) || 0,
        avg_oxygen: toNumberOrUndefined(avgOxygen),
        ambient_noise_level: toNumberOrUndefined(finishNoise),
      });
      setActiveSleepSessionId('');
      await refreshData();
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible finalizar el monitoreo.'));
    }
  };

  const handleSignOut = () => {
    signOut();
    navigation.replace('Auth');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Dashboard de sueno</Text>
          <Text style={styles.subtitle}>{user?.nombre_completo || 'Usuario autenticado'}</Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
          <Text style={styles.secondaryButtonText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={refreshData}>
          <Text style={styles.secondaryButtonText}>Actualizar</Text>
        </Pressable>
        {loading ? <ActivityIndicator color="#0B2545" /> : null}
      </View>

      {summary ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Indicadores</Text>
          <Text style={styles.cardText}>Sleep score: {summary.indicadores.sleep_score}</Text>
          <Text style={styles.cardText}>
            Eventos apnea + ronquido: {summary.indicadores.eventos_apnea_ronquido.total}
          </Text>
          <Text style={styles.cardText}>
            Ronquidos: {summary.indicadores.eventos_apnea_ronquido.ronquidos}
          </Text>
          <Text style={styles.cardText}>Apnea: {summary.indicadores.eventos_apnea_ronquido.apnea}</Text>
          <Text style={styles.disclaimer}>{summary.disclaimer_medico}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calibracion</Text>
        <Text style={styles.label}>Ruido ambiente (dB)</Text>
        <TextInput
          value={calibrationNoise}
          onChangeText={setCalibrationNoise}
          style={styles.input}
          keyboardType="decimal-pad"
        />
        <Pressable style={styles.primaryButton} onPress={handleCalibrate}>
          <Text style={styles.primaryButtonText}>Calibrar</Text>
        </Pressable>
        {calibrationMessage ? <Text style={styles.successText}>{calibrationMessage}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Monitoreo</Text>
        <Text style={styles.cardText}>Sesion activa: {openSessionId || 'Ninguna'}</Text>
        <View style={styles.buttonRow}>
          <Pressable style={styles.primaryButton} onPress={handleStartMonitoring}>
            <Text style={styles.primaryButtonText}>Iniciar</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={handleFinishMonitoring}>
            <Text style={styles.primaryButtonText}>Finalizar</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Ronquidos detectados</Text>
        <TextInput
          value={snoreCount}
          onChangeText={setSnoreCount}
          style={styles.input}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Eventos de apnea</Text>
        <TextInput
          value={apneaEvents}
          onChangeText={setApneaEvents}
          style={styles.input}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Promedio SpO2</Text>
        <TextInput
          value={avgOxygen}
          onChangeText={setAvgOxygen}
          style={styles.input}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Ruido final (dB)</Text>
        <TextInput
          value={finishNoise}
          onChangeText={setFinishNoise}
          style={styles.input}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Historial reciente</Text>
        {sessions.length === 0 ? <Text style={styles.cardText}>Sin sesiones registradas.</Text> : null}
        {sessions.map((session) => (
          <View key={session.session_id} style={styles.sessionRow}>
            <Text style={styles.sessionTitle}>{session.session_id.slice(0, 8)}</Text>
            <Text style={styles.cardText}>Score: {session.sleep_score ?? '--'}</Text>
            <Text style={styles.cardText}>Ronquido: {session.snore_count} | Apnea: {session.apnea_events}</Text>
            <Text style={styles.cardText}>{session.end_time ? 'Finalizada' : 'Activa'}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F4F7FB',
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0B2545',
  },
  subtitle: {
    marginTop: 4,
    color: '#475569',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  cardText: {
    color: '#334155',
    marginTop: 4,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#0B2545',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0B2545',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0B2545',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  successText: {
    marginTop: 8,
    color: '#166534',
  },
  disclaimer: {
    marginTop: 10,
    color: '#7C2D12',
    lineHeight: 18,
    fontSize: 12,
  },
  sessionRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  sessionTitle: {
    fontWeight: '700',
    color: '#1E293B',
  },
  errorText: {
    color: '#B91C1C',
    marginBottom: 16,
  },
});

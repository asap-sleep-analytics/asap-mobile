import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import ApneaRiskBadge from '../../../components/ApneaRiskBadge';
import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import SectionBadge from '../../../components/SectionBadge';
import { AppContext } from '../../../context/AppContext';
import { getApiErrorMessage, listSleepSessions, startSleepSession } from '../../../services/api';
import {
  getMonitorHintsHidden,
  getPreferredMonitorMode,
  getPreferredOximeterDevice,
  listSleepDiaryEntries,
  savePreferredMonitorMode,
  setMonitorHintsHidden,
} from '../../../services/localHealth';
import { getConnectedOximeter, isOximeterConnected } from '../../../services/oximeterBluetooth';
import { fonts, palette } from '../../../theme/tokens';
import type { MonitorMode, SleepDiaryEntry, SleepSessionStartPayload } from '../../../types';
import { riskFromApneaEvents } from '../../../utils/apneaRisk';

const NOISE_CALIBRATION_TOTAL_MS = 5000;
const NOISE_CALIBRATION_SAMPLE_MS = 250;

function toNumberOrUndefined(value: string | null | undefined): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function clampDb(value: number): number {
  return Math.max(0, Math.min(120, value));
}

function mapMeteringToAmbientDb(meteringDbfs: number): number {
  return clampDb(Math.round(meteringDbfs + 100));
}

function formatRelativeCalibratedTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  const mins = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (mins === 0) return 'justo ahora';
  if (mins === 1) return 'hace 1 min';
  return `hace ${mins} min`;
}

export default function MonitorControlScreen({ navigation }: { navigation: any }) {
  const { activeSleepSessionId, setActiveSleepSessionId } = useContext(AppContext);

  const [sessions, setSessions] = useState<any[]>([]);
  const [ambientNoise, setAmbientNoise] = useState<string>('45');
  const [isCalibratingNoise, setIsCalibratingNoise] = useState<boolean>(false);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState<number | null>(null);
  const [lastNoiseCalibrationAt, setLastNoiseCalibrationAt] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [working, setWorking] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const [showIntroModal, setShowIntroModal] = useState<boolean>(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState<boolean>(false);
  const [showPreparation, setShowPreparation] = useState<boolean>(false);
  const [monitorMode, setMonitorMode] = useState<MonitorMode>('cell_only');
  const [oximeterDevice, setOximeterDevice] = useState<any>(null);
  const [oximeterConnected, setOximeterConnected] = useState<boolean>(false);
  const [sleepDiaryEntries, setSleepDiaryEntries] = useState<SleepDiaryEntry[]>([]);
  const isCalibratingNoiseRef = useRef<boolean>(false);
  const lastNoiseCalibrationAtRef = useRef<number | null>(null);

  const recorder = useAudioRecorder({
    ...RecordingPresets.LOW_QUALITY,
    isMeteringEnabled: true,
  });

  const refreshSessions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [rows, diaryRows, savedMode, preferredDevice] = await Promise.all([
        listSleepSessions(12),
        listSleepDiaryEntries(),
        getPreferredMonitorMode(),
        getPreferredOximeterDevice(),
      ]);
      setSessions(Array.isArray(rows) ? rows : []);
      setSleepDiaryEntries(Array.isArray(diaryRows) ? diaryRows : []);
      setMonitorMode(savedMode);
      setOximeterDevice(preferredDevice || null);

      const live = getConnectedOximeter();
      if (live?.id && preferredDevice?.id && live.id === preferredDevice.id) {
        setOximeterConnected(true);
      } else if (preferredDevice?.id) {
        const active = await isOximeterConnected(preferredDevice.id);
        setOximeterConnected(active);
      } else {
        setOximeterConnected(false);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible cargar tus sesiones.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const autoCalibrateAmbientNoise = useCallback(async (showErrorMessage: boolean = false) => {
    if (isCalibratingNoiseRef.current) {
      return;
    }

    isCalibratingNoiseRef.current = true;
    setIsCalibratingNoise(true);
    setCalibrationSecondsLeft(Math.ceil(NOISE_CALIBRATION_TOTAL_MS / 1000));

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        if (showErrorMessage) {
          setError('No se pudo calibrar automáticamente: permiso de micrófono denegado.');
        }
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      const samples: number[] = [];
      const startedAt = Date.now();

      while (Date.now() - startedAt < NOISE_CALIBRATION_TOTAL_MS) {
        await new Promise<void>((resolve) => { setTimeout(resolve, NOISE_CALIBRATION_SAMPLE_MS); });
        const status = recorder.getStatus();
        if (status?.isRecording && typeof status.metering === 'number') {
          samples.push(status.metering);
        }

        const elapsed = Date.now() - startedAt;
        const remainingMs = Math.max(0, NOISE_CALIBRATION_TOTAL_MS - elapsed);
        setCalibrationSecondsLeft(Math.ceil(remainingMs / 1000));
      }

      await recorder.stop();

      await setAudioModeAsync({
        allowsRecording: false,
      });

      if (samples.length > 0) {
        const avgMetering = samples.reduce((acc: number, value: number) => acc + value, 0) / samples.length;
        const estimatedDb = mapMeteringToAmbientDb(avgMetering);
        setAmbientNoise(String(estimatedDb));
        const now = Date.now();
        setLastNoiseCalibrationAt(now);
        lastNoiseCalibrationAtRef.current = now;
      } else if (showErrorMessage) {
        setError('No se pudo estimar el ruido ambiente. Intenta recalibrar.');
      }
    } catch {
      if (showErrorMessage) {
        setError('Falló la calibración automática del ruido ambiente.');
      }
    } finally {
      try {
        if (recorder.isRecording) {
          await recorder.stop();
        }
      } catch {
        // ignore cleanup failures
      }
      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        // ignore cleanup failures
      }

      isCalibratingNoiseRef.current = false;
      setIsCalibratingNoise(false);
      setCalibrationSecondsLeft(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshSessions();
    }, [refreshSessions]),
  );

  const openSession = useMemo(() => {
    if (activeSleepSessionId) {
      return sessions.find((session: any) => session.session_id === activeSleepSessionId) || { session_id: activeSleepSessionId };
    }
    return sessions.find((session: any) => !session.end_time) || null;
  }, [activeSleepSessionId, sessions]);

  const latestFinished = useMemo(() => sessions.find((session: any) => !!session.end_time) || null, [sessions]);

  const epilepsyRisk = useMemo(() => riskFromApneaEvents(latestFinished?.apnea_events ?? 0), [latestFinished?.apnea_events]);

  const handleContinue = () => {
    const ambientNoiseLevel = toNumberOrUndefined(ambientNoise);
    navigation.navigate('MonitorActive', {
      sessionId: openSession.session_id,
      ambientNoiseLevel,
      monitoringMode: monitorMode,
    });
  };

  const performStart = async () => {
    const ambientNoiseLevel = toNumberOrUndefined(ambientNoise);
    setWorking(true);
    setError('');

    try {
      const payload: SleepSessionStartPayload = ambientNoiseLevel === undefined ? {} : { ambient_noise_level: ambientNoiseLevel };
      const response: any = await startSleepSession(payload);
      const sessionId = response.sesion.session_id;
      setActiveSleepSessionId(sessionId);
      navigation.navigate('MonitorActive', { sessionId, ambientNoiseLevel, monitoringMode: monitorMode });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible iniciar el monitoreo.'));
    } finally {
      setWorking(false);
    }
  };

  const handleStart = async () => {
    if (monitorMode === 'cell_oximeter' && !oximeterConnected) {
      setError('Para este modo debes conectar primero el oxímetro por Bluetooth.');
      return;
    }

    if (openSession?.session_id) {
      handleContinue();
      return;
    }

    const hidden = await getMonitorHintsHidden();
    if (hidden) {
      await performStart();
      return;
    }

    setShowIntroModal(true);
  };

  const confirmIntroAndStart = async () => {
    if (doNotShowAgain) {
      await setMonitorHintsHidden(true);
    }

    setShowIntroModal(false);
    await performStart();
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.content}>
      <SectionBadge label="Monitoreo nocturno" />
      <Text style={styles.title}>Vigila tu respiración mientras duermes</Text>
      <Text style={styles.subtitle}>Inicia una sesión para detectar apneas y ronquido durante la noche.</Text>

      <GlassCard style={styles.startCard}>
        <Text style={styles.startHint}>
          {openSession
            ? 'Ya tienes una sesión comenzada. Puedes continuarla o iniciar una nueva.'
            : 'A.S.A.P. usará el micrófono del celular para registrar fragmentos y analizarlos.'}
        </Text>

        <Pressable
          onPress={handleStart}
          disabled={working}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, working ? styles.disabled : null]}
        >
          {working ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {openSession ? 'Continuar monitoreo' : 'Iniciar monitoreo ahora'}
            </Text>
          )}
        </Pressable>

        {latestFinished ? (
          <View style={styles.lastRow}>
            <Text style={styles.lastLabel}>Última noche</Text>
            <ApneaRiskBadge visual={epilepsyRisk} size="sm" />
          </View>
        ) : null}

        <Pressable
          onPress={() => navigation.getParent()?.navigate('DashboardTab', { screen: 'HowItWorks' })}
          style={({ pressed }) => [styles.howLink, pressed ? styles.pressed : null]}
        >
          <Ionicons name="help-circle-outline" size={15} color={palette.textSecondary} />
          <Text style={styles.howLinkText}>¿Cómo funciona el monitoreo?</Text>
        </Pressable>
      </GlassCard>

      <Pressable
        onPress={() => setShowPreparation((visible) => !visible)}
        style={styles.sectionToggle}
        accessibilityRole="button"
        accessibilityLabel={showPreparation ? 'Ocultar preparación' : 'Ver preparación'}
      >
        <Text style={styles.sectionTitle}>Preparación</Text>
        <Ionicons name={showPreparation ? 'chevron-up' : 'chevron-down'} size={20} color={palette.textSecondary} />
      </Pressable>

      {showPreparation ? (
        <>
          <GlassCard style={styles.modeCard}>
        <Text style={styles.modeTitle}>Modo de monitoreo</Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={async () => {
              setMonitorMode('cell_only');
              await savePreferredMonitorMode('cell_only');
            }}
            style={({ pressed }) => [
              styles.modeChip,
              monitorMode === 'cell_only' ? styles.modeChipActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.modeChipText, monitorMode === 'cell_only' ? styles.modeChipTextActive : null]}>Solo celular</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              setMonitorMode('cell_oximeter');
              await savePreferredMonitorMode('cell_oximeter');
            }}
            style={({ pressed }) => [
              styles.modeChip,
              monitorMode === 'cell_oximeter' ? styles.modeChipActive : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.modeChipText, monitorMode === 'cell_oximeter' ? styles.modeChipTextActive : null]}>Celular + oxímetro</Text>
          </Pressable>
        </View>
        <Text style={styles.modeHint}>
          {monitorMode === 'cell_only'
            ? 'Usa el micrófono del celular. La precisión mejora con el oxímetro.'
            : `Oxímetro: ${oximeterConnected ? `Conectado (${oximeterDevice?.name || 'OK'})` : 'Sin conexión'}`}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('OximeterConnect')}
          style={({ pressed }) => [styles.oximeterButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.oximeterButtonText}>Conectar oxímetro por Bluetooth</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.noiseCard}>
        <Text style={styles.modeTitle}>Ruido ambiente</Text>
        <Text style={styles.noiseMetaText}>
          {isCalibratingNoise
            ? `Midiendo el ruido ambiente... ${calibrationSecondsLeft ?? 0}s`
            : lastNoiseCalibrationAt
            ? `Calibrado automáticamente (${formatRelativeCalibratedTime(lastNoiseCalibrationAt)}), ~${ambientNoise} dB`
            : `Nivel objetivo: ~${ambientNoise} dB. Puedes recalibrar.`}
        </Text>
        <Pressable
          onPress={() => autoCalibrateAmbientNoise(true)}
          disabled={isCalibratingNoise || working}
          style={({ pressed }) => [
            styles.secondaryButton,
            (isCalibratingNoise || working) ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            {isCalibratingNoise ? `Calibrando ${calibrationSecondsLeft ?? 0}s` : 'Medir ruido ambiente'}
          </Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.diaryPromoCard}>
        <Text style={styles.modeTitle}>Registro de horas de sueño</Text>
        <Text style={styles.noiseMetaText}>
          {sleepDiaryEntries.length > 0
            ? `Llevas ${sleepDiaryEntries.length} registros guardados.`
            : 'Aún no registras tu horario de sueño. Es útil para el análisis.'}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('SleepDiary')}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.secondaryButtonText}>
            {sleepDiaryEntries.length > 0 ? 'Actualizar registro' : 'Registrar horas de sueño'}
          </Text>
        </Pressable>
          </GlassCard>
        </>
      ) : null}

      {loading ? <ActivityIndicator color={palette.primary} style={styles.loader} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={showIntroModal} transparent animationType="fade" onRequestClose={() => setShowIntroModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Antes de iniciar el monitoreo</Text>
            <Text style={styles.modalBullet}>• Puedes bloquear la pantalla mientras monitoreas: la grabación se retoma al volver.</Text>
            <Text style={styles.modalBullet}>• Si cierras la app por completo, el monitoreo se detiene y la sesión queda abierta para continuarla después.</Text>
            <Text style={styles.modalBullet}>• Se capturan fragmentos cortos de audio, no toda la noche de forma continua.</Text>
            <Text style={styles.modalBullet}>• Mantén el teléfono cerca de la cama, con batería suficiente y sin cubrir el micrófono.</Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>No volver a mostrar</Text>
              <Switch value={doNotShowAgain} onValueChange={setDoNotShowAgain} />
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalGhost} onPress={() => setShowIntroModal(false)}>
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalPrimary} onPress={confirmIntroAndStart}>
                <Text style={styles.modalPrimaryText}>Entendido, iniciar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
    gap: 12,
  },
  title: {
    marginTop: 10,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  startCard: {
    borderColor: 'rgba(37,99,235,0.3)',
    backgroundColor: '#FFFFFF',
  },
  startHint: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 19,
    marginBottom: 12,
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  lastRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastLabel: {
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  howLink: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  howLinkText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  sectionTitle: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 6,
  },
  modeCard: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  modeTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  modeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeChipActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  modeChipText: {
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  modeChipTextActive: {
    color: palette.primary,
  },
  modeHint: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  oximeterButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.4)',
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  oximeterButtonText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  noiseCard: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  noiseMetaText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    alignItems: 'center',
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  diaryPromoCard: {
    borderColor: 'rgba(37,99,235,0.24)',
    backgroundColor: palette.surface,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    padding: 16,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
    marginBottom: 10,
  },
  modalBullet: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
    marginBottom: 6,
  },
  switchRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  modalGhost: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalGhostText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
  },
});
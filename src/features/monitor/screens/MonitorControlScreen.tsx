import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

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
      if (!lastNoiseCalibrationAtRef.current) {
        autoCalibrateAmbientNoise(false);
      }
    }, [refreshSessions, autoCalibrateAmbientNoise]),
  );

  const openSession = useMemo(() => {
    if (activeSleepSessionId) {
      return sessions.find((session: any) => session.session_id === activeSleepSessionId) || { session_id: activeSleepSessionId };
    }
    return sessions.find((session: any) => !session.end_time) || null;
  }, [activeSleepSessionId, sessions]);

  const latestFinished = useMemo(() => sessions.find((session: any) => !!session.end_time) || null, [sessions]);

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
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <SectionBadge label="Monitor de sueño" />
      <Text style={styles.title}>Tu descanso, en tus manos</Text>
      <Text style={styles.subtitle}>Inicia el monitoreo nocturno o registra manualmente tus horas de sueño.</Text>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Sesión activa</Text>
          <Text style={styles.metricValue}>{openSession ? 'Sí' : 'No'}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Último puntaje</Text>
          <Text style={styles.metricValue}>{latestFinished?.sleep_score ?? '--'}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Configuración rápida</Text>
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
            ? 'Usa solo el micrófono del celular para el monitoreo nocturno.'
            : `Estado del oxímetro: ${oximeterConnected ? `Conectado (${oximeterDevice?.name || 'OK'})` : 'Sin conexión'}`}
        </Text>
        <Pressable
          onPress={() => navigation.navigate('OximeterConnect')}
          style={({ pressed }) => [styles.oximeterButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.oximeterButtonText}>Conectar oxímetro por Bluetooth</Text>
        </Pressable>
      </GlassCard>

      <Text style={styles.label}>Ruido ambiente objetivo (en decibeles)</Text>
      <TextInput
        value={ambientNoise}
        onChangeText={(value: string) => {
          setAmbientNoise(value);
          setLastNoiseCalibrationAt(null);
          lastNoiseCalibrationAtRef.current = null;
        }}
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="45"
        placeholderTextColor={palette.textMuted}
      />
      <View style={styles.noiseMetaRow}>
        <Text style={styles.noiseHint}>
          {isCalibratingNoise
            ? `Midiendo el ruido ambiente... ${calibrationSecondsLeft ?? 0}s`
            : lastNoiseCalibrationAt
            ? `Valor automático (${formatRelativeCalibratedTime(lastNoiseCalibrationAt)})`
            : 'Puedes ajustar el valor manualmente si lo deseas.'}
        </Text>
        <Pressable
          onPress={() => autoCalibrateAmbientNoise(true)}
          disabled={isCalibratingNoise || working}
          style={({ pressed }) => [
            styles.recalibrateButton,
            (isCalibratingNoise || working) ? styles.disabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={styles.recalibrateButtonText}>
            {isCalibratingNoise ? `Calibrando ${calibrationSecondsLeft ?? 0}s` : 'Medir de nuevo'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={handleStart}
        disabled={working}
        style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, working ? styles.disabled : null]}
      >
        {working ? (
          <ActivityIndicator color="#03110C" />
        ) : (
            <Text style={styles.primaryButtonText}>
              {openSession
                ? 'Continuar monitoreo'
                : monitorMode === 'cell_only'
                ? 'Iniciar monitoreo con el celular'
                : 'Iniciar monitoreo celular + oxímetro'}
            </Text>
        )}
      </Pressable>

      <GlassCard style={styles.diaryPromoCard}>
        <Text style={styles.diaryPromoTitle}>Horas de sueño</Text>
        
        {sleepDiaryEntries.length > 0 && (
          <View style={styles.diaryList}>
            <Text style={styles.diaryListLabel}>Últimos registros</Text>
            {sleepDiaryEntries.slice(0, 3).map((entry: SleepDiaryEntry) => (
              <View key={entry.id} style={styles.diaryItem}>
                <Text style={styles.diaryItemDate}>
                  {new Date(entry.date).toLocaleDateString('es-CO')}
                </Text>
                <Text style={styles.diaryItemTime}>
                  {entry.bedtime} - {entry.wakeTime}
                </Text>
                <Text style={styles.diaryItemHours}>
                  {entry.estimatedHours}h
                </Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate('SleepDiary')}
          style={({ pressed }) => [styles.diaryPromoButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.diaryPromoButtonText}>
            {sleepDiaryEntries.length > 0 ? 'Actualizar registro' : 'Registrar horas de sueño'}
          </Text>
        </Pressable>
      </GlassCard>

      <Pressable onPress={refreshSessions} style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}>
        <Text style={styles.ghostButtonText}>Actualizar estado</Text>
      </Pressable>

      {loading ? <ActivityIndicator color={palette.mint} style={styles.loader} /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={showIntroModal} transparent animationType="fade" onRequestClose={() => setShowIntroModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Antes de iniciar el monitoreo</Text>
            <Text style={styles.modalBullet}>• Puedes salir de la app: el proceso continuará por intervalos.</Text>
            <Text style={styles.modalBullet}>• Se capturan fragmentos cortos de audio, no toda la noche de forma continua.</Text>
            <Text style={styles.modalBullet}>• Mantén el teléfono cerca de la cama y con batería suficiente.</Text>
            <Text style={styles.modalBullet}>• Evita cubrir el micrófono y reduce ruidos fuertes.</Text>

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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,
    gap: 12,
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
    marginTop: 12,
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
  metricGrid: {
    marginTop: 10,
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
  sectionTitle: {
    marginTop: 8,
    color: palette.warning,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  modeCard: {
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'rgba(12,30,24,0.85)',
  },
  modeTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modeChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.28)',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeChipActive: {
    borderColor: palette.mint,
    backgroundColor: 'rgba(110,247,207,0.15)',
  },
  modeChipText: {
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  modeChipTextActive: {
    color: palette.mint,
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
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  oximeterButtonText: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  label: {
    marginTop: 2,
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
  noiseMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noiseHint: {
    flex: 1,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },
  recalibrateButton: {
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.45)',
    borderRadius: 10,
    backgroundColor: 'rgba(110,247,207,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recalibrateButtonText: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 8,
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
  diaryPromoCard: {
    borderColor: 'rgba(110,247,207,0.36)',
    backgroundColor: 'rgba(12,30,24,0.85)',
  },
  diaryPromoTitle: {
    color: '#C0FFDB',
    fontFamily: fonts.headingMedium,
    fontSize: 18,
  },
  diaryList: {
    marginTop: 10,
    gap: 6,
  },
  diaryListLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  diaryItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.24)',
    backgroundColor: 'rgba(110,247,207,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diaryItemDate: {
    flex: 1,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
  },
  diaryItemTime: {
    flex: 1,
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textAlign: 'center',
  },
  diaryItemHours: {
    flex: 0.5,
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    textAlign: 'right',
  },
  diaryPromoButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(110,247,207,0.5)',
    backgroundColor: 'rgba(110,247,207,0.16)',
    alignItems: 'center',
    paddingVertical: 11,
  },
  diaryPromoButtonText: {
    color: '#C0FFDB',
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  ghostButton: {
    marginTop: 6,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: '#07110F',
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
    borderColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: '#03110C',
    fontFamily: fonts.bodyBold,
  },
});

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AudioQuality, IOSOutputFormat, getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Brightness from 'expo-brightness';
import * as FileSystem from 'expo-file-system/legacy';
import { useKeepAwake } from 'expo-keep-awake';

import { AppContext } from '../../../context/AppContext';
import { finishSleepSession, uploadSleepFragment, predictApneaFromFile } from '../../../services/api';
import { triggerSevereApneaAlert } from '../../../services/emergencyAlerts';
import { getEmergencyAlertSettings } from '../../../services/localHealth';
import { getLatestOximeterReading, startOximeterReading, stopOximeterReading } from '../../../services/oximeterBluetooth';
import { fonts, palette } from '../../../theme/tokens';
import type { OximeterReading } from '../../../types';
import ApneaResultCard from '../../../components/ApneaResultCard';
import { riskFromPredictionNivel } from '../../../utils/apneaRisk';

interface RouteParams {
  sessionId?: string;
  ambientNoiseLevel?: number;
  monitoringMode?: string;
}

interface Props {
  route: { params?: RouteParams };
  navigation: {
    replace: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
    addListener: (event: string, callback: (event: { preventDefault: () => void }) => void) => () => void;
  };
}

interface EmergencySettings {
  enabled: boolean;
  severe_threshold_events?: number;
  methods?: {
    wake_alarm?: boolean;
    notification?: boolean;
    whatsapp?: boolean;
    sms?: boolean;
    email?: boolean;
  };
  auto_dispatch?: boolean;
  contacts?: Array<{ phone?: string; email?: string }>;
}

interface PredictionResult {
  nivel: string;
  interpretacion: string;
  probabilidad: number;
}

const FRAGMENT_DURATION_MS = 30_000;
const WAVE_BARS = 28;

const RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  extension: '.m4a',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  android: {
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
} as const;

function meterToLevel(metering: number): number {
  const clamped = Math.max(-60, Math.min(0, metering));
  return (clamped + 60) / 60;
}

function meterToAmbientDb(metering: number): number {
  const clamped = Math.max(-60, Math.min(0, metering));
  const normalized = (clamped + 60) / 60;
  return Math.round(normalized * 55 + 25);
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MonitorActiveScreen({ route, navigation }: Props) {
  useKeepAwake();

  const { setActiveSleepSessionId } = useContext(AppContext);
  const sessionId = route?.params?.sessionId || '';
  const ambientNoiseLevel = route?.params?.ambientNoiseLevel;
  const monitoringMode = route?.params?.monitoringMode || 'cell_only';

  const [isPreparing, setIsPreparing] = useState(true);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadedFragments, setUploadedFragments] = useState(0);
  const [capturedFragments, setCapturedFragments] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [silentErrors, setSilentErrors] = useState(0);
  const [statusText, setStatusText] = useState('Preparando monitoreo...');
  const [wavePoints, setWavePoints] = useState(Array.from({ length: WAVE_BARS }, () => 0.08));

  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [spo2Values, setSpo2Values] = useState<number[]>([]);
  const [liveSpo2, setLiveSpo2] = useState<number | null>(null);
  const [livePulse, setLivePulse] = useState<number | null>(null);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const handleOximeterReading = (reading: OximeterReading) => {
    if (reading.spo2 !== null) {
      setLiveSpo2(reading.spo2);
      spo2SamplesRef.current = [...spo2SamplesRef.current.slice(-11), reading.spo2];
    }
    if (reading.pulse !== null) {
      setLivePulse(reading.pulse);
    }
  };

  const monitoringRef = useRef(false);
  const recordingRef = useRef<typeof recorder | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fragmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fragmentStartedAtRef = useRef(0);
  const fragmentIndexRef = useRef(0);
  const isFinalizingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const mountedRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);

  const brightnessBeforeRef = useRef<number | null>(null);

  const peakEventsRef = useRef(0);
  const lastPeakAtRef = useRef(0);
  const meteringSumRef = useRef(0);
  const meteringSamplesRef = useRef(0);
  const severeAlertTriggeredRef = useRef(false);
  const emergencySettingsRef = useRef<EmergencySettings | null>(null);
  const spo2SamplesRef = useRef<number[]>([]);

  const maybeTriggerSevereAlert = async () => {
    if (severeAlertTriggeredRef.current) {
      return;
    }

    const settings = emergencySettingsRef.current;
    if (!settings?.enabled) {
      return;
    }

    const threshold = Number(settings.severe_threshold_events || 8);
    const estimatedApnea = Math.floor(peakEventsRef.current / 12);
    if (estimatedApnea < threshold) {
      return;
    }

    severeAlertTriggeredRef.current = true;
    setStatusText('Alerta: patrón severo detectado. Activando protocolo de seguridad...');

    await triggerSevereApneaAlert(settings, {
      sessionId,
      estimatedEvents: estimatedApnea,
      monitoringMode,
    });
  };

  const elapsedLabel = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds]);

  const latestPrediction = useMemo(() => predictions[predictions.length - 1] || null, [predictions]);
  const riskVisual = useMemo(() => riskFromPredictionNivel(latestPrediction?.nivel), [latestPrediction]);

  const clearFragmentTimer = () => {
    if (fragmentTimerRef.current) {
      clearTimeout(fragmentTimerRef.current);
      fragmentTimerRef.current = null;
    }
  };

  const clearMeteringTimer = () => {
    if (meteringTimerRef.current) {
      clearInterval(meteringTimerRef.current);
      meteringTimerRef.current = null;
    }
  };

  const clearElapsedTimer = () => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  const startElapsedTicker = () => {
    clearElapsedTimer();
    elapsedTimerRef.current = setInterval(() => {
      if (!mountedRef.current || !monitoringRef.current) {
        return;
      }
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const applyLowBrightness = async () => {
    try {
      const current = await Brightness.getBrightnessAsync();
      brightnessBeforeRef.current = current;

      const permission = await Brightness.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Brightness.setBrightnessAsync(0.02);
      }
    } catch {
      // Fallback silencioso
    }
  };

  const restoreBrightness = async () => {
    try {
      if (brightnessBeforeRef.current !== null) {
        await Brightness.setBrightnessAsync(brightnessBeforeRef.current);
      }
    } catch {
      // Evita bloquear cierre de monitoreo
    }
  };

  const updateWaveFromMetering = (metering: number) => {
    const level = meterToLevel(metering);
    const ambientDb = meterToAmbientDb(metering);

    meteringSumRef.current += ambientDb;
    meteringSamplesRef.current += 1;

    const now = Date.now();
    if (level > 0.82 && now - lastPeakAtRef.current > 1500) {
      peakEventsRef.current += 1;
      lastPeakAtRef.current = now;
      maybeTriggerSevereAlert().catch(() => null);
    }

    setWavePoints((previous) => {
      const next = previous.slice(1);
      next.push(Math.max(0.05, level));
      return next;
    });
  };

  const uploadAndDeleteFragment = async ({
    uri,
    durationSeconds,
    startedAtMs,
    fragmentIndex,
  }: {
    uri: string;
    durationSeconds: number;
    startedAtMs: number;
    fragmentIndex: number;
  }) => {
    if (!uri || !sessionId) {
      return;
    }

    setPendingUploads((prev) => prev + 1);

    try {
      await uploadSleepFragment({
        sessionId,
        fileUri: uri,
        fragmentIndex,
        durationSeconds,
        startedAt: new Date(startedAtMs).toISOString(),
      });
      if (mountedRef.current) {
        setUploadedFragments((prev) => prev + 1);
      }
    } catch (error) {
      if (mountedRef.current) {
        setSilentErrors((prev) => prev + 1);
      }
    } finally {
      if (mountedRef.current) {
        setPendingUploads((prev) => Math.max(0, prev - 1));
      }

      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch {
        // Archivo ya eliminado
      }
    }
  };

  const finalizeCurrentFragment = async () => {
    if (isFinalizingRef.current) {
      return;
    }

    const recording = recordingRef.current;
    if (!recording) {
      return;
    }

    isFinalizingRef.current = true;
    clearFragmentTimer();
    clearMeteringTimer();

    let status: ReturnType<typeof recorder.getStatus> | null = null;
    try {
      status = recorder.getStatus();
      if (status?.isRecording) {
        await recorder.stop();
      }
    } catch {
      // La grabación pudo detenerse por sistema
    }

    const uri = recorder.uri;
    recordingRef.current = null;

    const fragmentIndex = fragmentIndexRef.current;
    fragmentIndexRef.current += 1;

    const startedAtMs = fragmentStartedAtRef.current || Date.now();
    const durationSeconds = status?.durationMillis
      ? Math.max(1, Math.round(status.durationMillis / 1000))
      : Math.max(1, Math.round((Date.now() - startedAtMs) / 1000));

    if (mountedRef.current) {
      setCapturedFragments((prev) => prev + 1);
    }

    if (uri) {
      await uploadAndDeleteFragment({
        uri,
        durationSeconds,
        startedAtMs,
        fragmentIndex,
      });
    }

    if (uri && fragmentIndex > 0) {
      try {
        const realSpo2 = spo2SamplesRef.current.slice(-10);
        spo2SamplesRef.current = [];
        setSpo2Values(realSpo2);

        const result = await predictApneaFromFile({
          fileUri: uri,
          spo2: realSpo2.length > 0 ? realSpo2 : undefined,
          modo: 'screening',
          perfil: 'general',
        });

        if (mountedRef.current && result) {
          setPredictions((prev) => [...prev.slice(-4), result]);
          setStatusText('Análisis actualizado con tu último fragmento.');

          if (result.nivel === 'CRITICO' && emergencySettingsRef.current?.enabled) {
            try {
              await triggerSevereApneaAlert(emergencySettingsRef.current, {
                sessionId,
                estimatedEvents: 1,
                monitoringMode,
              });
            } catch {
              // Error silencioso
            }
          }
        }
      } catch {
        // Predicción falló silenciosamente
      }
    }

    isFinalizingRef.current = false;
  };

  const startNextFragment = async () => {
    if (!monitoringRef.current) {
      return;
    }

    try {
      await recorder.prepareToRecordAsync();
      recorder.record();

      recordingRef.current = recorder;
      fragmentStartedAtRef.current = Date.now();

      clearMeteringTimer();
      meteringTimerRef.current = setInterval(() => {
        const status = recorder.getStatus();
        if (status?.isRecording && typeof status.metering === 'number') {
          updateWaveFromMetering(status.metering);
        }
      }, 250);

      clearFragmentTimer();
      fragmentTimerRef.current = setTimeout(async () => {
        await finalizeCurrentFragment();
        if (monitoringRef.current) {
          await startNextFragment();
        }
      }, FRAGMENT_DURATION_MS);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setStatusText('No fue posible iniciar la grabación.');
      setIsMonitoring(false);
      monitoringRef.current = false;
    }
  };

  const requestAudioPermission = async (): Promise<boolean> => {
    const current = await getRecordingPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const requested = await requestRecordingPermissionsAsync();
    return requested.granted;
  };

  const bootstrapMonitoring = async () => {
    if (!sessionId) {
      setStatusText('No se encontró una sesión válida para iniciar el monitoreo.');
      setPermissionGranted(false);
      setIsPreparing(false);
      return;
    }

    try {
      emergencySettingsRef.current = await getEmergencyAlertSettings();

      const granted = await requestAudioPermission();
      setPermissionGranted(granted);

      if (!granted) {
        setStatusText('Permiso de micrófono requerido para iniciar monitoreo.');
        setIsPreparing(false);
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });

      await applyLowBrightness();

      if (monitoringMode === 'cell_oximeter') {
        try {
          await startOximeterReading(handleOximeterReading);
          setStatusText('Oxímetro vinculado. Registrando SpO2 real.');
        } catch {
          setStatusText('No se pudo leer el oxímetro. La sesión continuará solo con audio.');
        }
      }

      monitoringRef.current = true;
      setIsMonitoring(true);
      setIsPreparing(false);
      if (monitoringMode !== 'cell_oximeter') {
        setStatusText('Monitoreo activo. Fragmentando cada 30 segundos.');
      }
      startElapsedTicker();
      await startNextFragment();
    } catch (error) {
      setStatusText('No fue posible inicializar el monitoreo.');
      setIsPreparing(false);
      setIsMonitoring(false);
    }
  };

  const finishMonitoring = async () => {
    if (isStoppingRef.current) {
      return;
    }
    isStoppingRef.current = true;

    monitoringRef.current = false;
    setIsMonitoring(false);
    setStatusText('Finalizando monitoreo...');

    clearFragmentTimer();
    clearElapsedTimer();

    stopOximeterReading().catch(() => null);

    await finalizeCurrentFragment();

    const estimatedSnore = peakEventsRef.current;
    const estimatedApnea = Math.floor(peakEventsRef.current / 12);
    const computedAmbient = meteringSamplesRef.current
      ? Math.round(meteringSumRef.current / meteringSamplesRef.current)
      : undefined;

    const finalAmbientNoise =
      typeof ambientNoiseLevel === 'number'
        ? ambientNoiseLevel
        : computedAmbient;

    try {
      const finished = await finishSleepSession(sessionId, {
        snore_count: estimatedSnore,
        apnea_events: estimatedApnea,
        ambient_noise_level: finalAmbientNoise,
      });
      allowLeaveRef.current = true;
      setActiveSleepSessionId('');
      navigation.replace('MonitorSummary', { session: finished || null });
    } catch {
      allowLeaveRef.current = true;
      setActiveSleepSessionId('');
      navigation.replace('MonitorSummary', {
        session: {
          session_id: sessionId,
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          snore_count: estimatedSnore,
          apnea_events: estimatedApnea,
        },
      });
    }

    try {
      await setAudioModeAsync({
        allowsRecording: false,
      });
    } catch {
      // Sin bloqueo
    }

    await restoreBrightness();
  };

  const leaveWithoutSaving = () => {
    allowLeaveRef.current = true;
    monitoringRef.current = false;
    setIsMonitoring(false);
    setShowExitModal(false);
    setStatusText('Saliste del monitoreo. La sesión quedó abierta y puedes continuarla desde Monitorear.');
    navigation.goBack();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || !monitoringRef.current || !mountedRef.current) {
        return;
      }
      event.preventDefault();
      setShowExitModal(true);
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    mountedRef.current = true;
    bootstrapMonitoring();

    return () => {
      mountedRef.current = false;
      monitoringRef.current = false;
      clearFragmentTimer();
      clearMeteringTimer();
      clearElapsedTimer();
      stopOximeterReading().catch(() => null);

      const cleanup = async () => {
        try {
          if (recorder.isRecording) {
            await recorder.stop();
            const uri = recorder.uri;
            if (uri) {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            }
          }
        } catch {
          // Cleanup defensivo
        }

        await restoreBrightness();

        try {
          await setAudioModeAsync({ allowsRecording: false });
        } catch {
          // Sin bloqueo
        }
      };

      cleanup();
    };
  }, [sessionId]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.badge}>Monitoreo nocturno</Text>
        <Text style={styles.timer}>{elapsedLabel}</Text>
      </View>

      <View style={[styles.riskCard, { backgroundColor: riskVisual.softColor, borderColor: riskVisual.color }]}>
        <Text style={[styles.riskLabel, { color: riskVisual.color }]}>Riesgo de apnea en vivo</Text>
        <View style={styles.riskRow}>
          <View style={styles.riskTextWrap}>
            <Text style={[styles.riskTitle, { color: riskVisual.color }]}>{riskVisual.label}</Text>
            <Text style={styles.riskSubtitle}>{riskVisual.interpretation}</Text>
          </View>
          {latestPrediction ? (
            <View style={[styles.probBadge, { borderColor: riskVisual.color }]}>
              <Text style={[styles.probValue, { color: riskVisual.color }]}>
                {(latestPrediction.probabilidad * 100).toFixed(0)}%
              </Text>
              <Text style={styles.probLabel}>certeza</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.modeText}>
        {monitoringMode === 'cell_oximeter' ? 'Modo: Celular + oxímetro' : 'Modo: Solo celular'}
      </Text>

      {predictions.length > 0 ? (
        <View style={styles.spo2Row}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Fragmentos analizados</Text>
            <Text style={styles.metricValue}>{predictions.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{liveSpo2 !== null ? 'SpO2 en vivo' : 'SpO2'}</Text>
            <Text style={styles.metricValue}>
              {liveSpo2 !== null ? `${liveSpo2}%` : spo2Values.length > 0 ? `${spo2Values[spo2Values.length - 1]}%` : '--'}
            </Text>
          </View>
          {monitoringMode === 'cell_oximeter' && livePulse !== null ? (
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Pulso</Text>
              <Text style={styles.metricValue}>{livePulse} bpm</Text>
            </View>
          ) : null}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Estado</Text>
            <Text style={[styles.metricValue, { color: isMonitoring ? palette.success : palette.danger, fontSize: 16 }]}>
              {isMonitoring ? 'Activo' : 'Detenido'}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.statusText}>{statusText}</Text>

      <View style={styles.waveWrap}>
        {wavePoints.map((point, index) => {
          const barHeight = Math.max(8, Math.round(point * 96));
          return <View key={`wave-${index}`} style={[styles.waveBar, { height: barHeight }]} />;
        })}
      </View>

      {silentErrors > 0 ? (
        <Text style={styles.microText}>
          Algunos fragmentos no pudieron subirse ahora; se reintentará al finalizar.
        </Text>
      ) : null}

      {isPreparing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.primary} />
          <Text style={styles.loadingText}>Solicitando permisos de audio...</Text>
        </View>
      ) : null}

      {predictions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.predictionsScroll}
          contentContainerStyle={styles.predictionsContent}
        >
          {predictions.slice(-4).map((pred, idx) => (
            <View key={`pred-${idx}`} style={styles.predictionCardWrapper}>
              <ApneaResultCard result={pred} />
            </View>
          ))}
        </ScrollView>
      )}

      {!permissionGranted ? (
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Volver</Text>
        </Pressable>
      ) : (
        <>
          <Pressable
            style={[styles.stopButton, !isMonitoring ? styles.stopButtonDisabled : null]}
            onPress={() => setShowExitModal(true)}
            disabled={!isMonitoring}
          >
            <Text style={styles.stopButtonText}>Terminar monitoreo</Text>
          </Pressable>
          <Text style={styles.exitNote}>
            Si cierras la app por completo, la grabación se detiene. La sesión queda abierta y podrás continuarla desde
            la pestaña Monitorear.
          </Text>
        </>
      )}

      <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Terminar la sesión</Text>
            <Text style={styles.modalText}>
              Elige cómo quieres cerrar este monitoreo:
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowExitModal(false);
                  finishMonitoring();
                }}
                style={({ pressed }) => [styles.modalPrimary, pressed ? styles.pressed : null]}
              >
                <Text style={styles.modalPrimaryText}>Finalizar y guardar</Text>
              </Pressable>

              <Pressable
                onPress={leaveWithoutSaving}
                style={({ pressed }) => [styles.modalGhost, pressed ? styles.pressed : null]}
              >
                <Text style={styles.modalGhostText}>Salir sin guardar</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowExitModal(false)}
                style={({ pressed }) => [styles.modalCancel, pressed ? styles.pressed : null]}
              >
                <Text style={styles.modalCancelText}>Continuar monitoreando</Text>
              </Pressable>
            </View>

            <Text style={styles.modalNote}>
              Si saldrás sin guardar, la sesión queda abierta en tu cuenta y podrás continuarla después.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 26,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  timer: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 28,
  },
  riskCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  riskLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  riskRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  riskTextWrap: {
    flex: 1,
  },
  riskTitle: {
    fontFamily: fonts.heading,
    fontSize: 30,
    lineHeight: 34,
  },
  riskSubtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  probBadge: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  probValue: {
    fontFamily: fonts.heading,
    fontSize: 22,
  },
  probLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
  },
  modeText: {
    marginTop: 12,
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  spo2Row: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  metricLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricValue: {
    marginTop: 6,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 22,
  },
  statusText: {
    marginTop: 12,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  waveWrap: {
    marginTop: 14,
    height: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: '#F8FAFD',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  waveBar: {
    width: 7,
    borderRadius: 6,
    backgroundColor: palette.primary,
    opacity: 0.9,
  },
  microText: {
    marginTop: 10,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  loadingWrap: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  predictionsScroll: {
    marginTop: 14,
  },
  predictionsContent: {
    gap: 10,
    paddingBottom: 4,
  },
  predictionCardWrapper: {
    minWidth: 270,
  },
  stopButton: {
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: palette.danger,
    alignItems: 'center',
    paddingVertical: 14,
  },
  stopButtonDisabled: {
    opacity: 0.55,
  },
  stopButtonText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  exitNote: {
    marginTop: 10,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    padding: 20,
  },
  modalTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  modalText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  modalActions: {
    marginTop: 16,
    gap: 10,
  },
  modalPrimary: {
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    paddingVertical: 13,
  },
  modalPrimaryText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  modalGhost: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    paddingVertical: 13,
  },
  modalGhostText: {
    color: palette.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  modalCancel: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    alignItems: 'center',
    paddingVertical: 13,
  },
  modalCancelText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  modalNote: {
    marginTop: 12,
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
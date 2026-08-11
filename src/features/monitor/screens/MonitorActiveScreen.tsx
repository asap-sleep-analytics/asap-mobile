import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import * as Brightness from 'expo-brightness';
import * as FileSystem from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';

import { AppContext } from '../../../context/AppContext';
import { finishSleepSession, uploadSleepFragment, predictApneaFromFile } from '../../../services/api';
import { triggerSevereApneaAlert } from '../../../services/emergencyAlerts';
import { getEmergencyAlertSettings } from '../../../services/localHealth';
import { fonts, palette } from '../../../theme/tokens';
import { useApneaDetection } from '../../../hooks/useApneaDetection';
import ApneaResultCard from '../../../components/ApneaResultCard';

interface RouteParams {
  sessionId?: string;
  ambientNoiseLevel?: number;
  monitoringMode?: string;
}

interface Props {
  route: { params?: RouteParams };
  navigation: { replace: (screen: string) => void; goBack: () => void };
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

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4 as number,
    audioEncoder: Audio.AndroidAudioEncoder.AAC as number,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC as number,
    audioQuality: Audio.IOSAudioQuality.MAX as number,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

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

function generateSimulatedSpo2Values(count = 10): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(Math.floor(92 + Math.random() * 5));
  }
  return values;
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

  const monitoringRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const fragmentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fragmentStartedAtRef = useRef(0);
  const fragmentIndexRef = useRef(0);
  const isFinalizingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const mountedRef = useRef(false);

  const brightnessBeforeRef = useRef<number | null>(null);

  const peakEventsRef = useRef(0);
  const lastPeakAtRef = useRef(0);
  const meteringSumRef = useRef(0);
  const meteringSamplesRef = useRef(0);
  const severeAlertTriggeredRef = useRef(false);
  const emergencySettingsRef = useRef<EmergencySettings | null>(null);

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

  const shortSession = useMemo(() => (sessionId ? sessionId.slice(0, 8) : '--'), [sessionId]);
  const elapsedLabel = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds]);

  const clearFragmentTimer = () => {
    if (fragmentTimerRef.current) {
      clearTimeout(fragmentTimerRef.current);
      fragmentTimerRef.current = null;
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

    let status: Audio.RecordingStatus | null = null;
    try {
      status = await recording.getStatusAsync();
      if (status?.isRecording) {
        await recording.stopAndUnloadAsync();
      }
    } catch {
      // La grabación pudo detenerse por sistema
    }

    const uri = recording.getURI();
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
        const currentSpo2 = generateSimulatedSpo2Values(10);
        setSpo2Values(currentSpo2);

        const result = await predictApneaFromFile({
          fileUri: uri,
          spo2: currentSpo2,
          modo: 'screening',
          perfil: 'general',
        });

        if (mountedRef.current && result) {
          setPredictions((prev) => [...prev.slice(-4), result]);

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
      const recording = new Audio.Recording();
      recording.setProgressUpdateInterval(250);
      recording.setOnRecordingStatusUpdate((status) => {
        if (!status?.canRecord || typeof status.metering !== 'number') {
          return;
        }
        updateWaveFromMetering(status.metering);
      });

      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();

      recordingRef.current = recording;
      fragmentStartedAtRef.current = Date.now();

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
    const current = await Audio.getPermissionsAsync();
    if (current.granted) {
      return true;
    }

    const requested = await Audio.requestPermissionsAsync();
    return requested.granted;
  };

  const bootstrapMonitoring = async () => {
    if (!sessionId) {
      setStatusText('No se encontró session_id para monitoreo.');
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

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      await applyLowBrightness();

      monitoringRef.current = true;
      setIsMonitoring(true);
      setIsPreparing(false);
      setStatusText('Monitoreo activo. Fragmentando cada 30 segundos.');
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
      await finishSleepSession(sessionId, {
        snore_count: estimatedSnore,
        apnea_events: estimatedApnea,
        ambient_noise_level: finalAmbientNoise,
      });
      setActiveSleepSessionId('');
    } catch {
      // Error silencioso
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
    } catch {
      // Sin bloqueo
    }

    await restoreBrightness();
    navigation.replace('MonitorCenter');
  };

  useEffect(() => {
    mountedRef.current = true;
    bootstrapMonitoring();

    return () => {
      mountedRef.current = false;
      monitoringRef.current = false;
      clearFragmentTimer();
      clearElapsedTimer();

      const cleanup = async () => {
        try {
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            recordingRef.current = null;
            if (uri) {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            }
          }
        } catch {
          // Cleanup defensivo
        }

        await restoreBrightness();

        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
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

      <Text style={styles.sessionText}>Sesion {shortSession}</Text>
      <Text style={styles.modeText}>
        {monitoringMode === 'cell_oximeter' ? 'Modo: Celular + oxímetro' : 'Modo: Solo celular'}
      </Text>
      <Text style={styles.statusText}>{statusText}</Text>

      <View style={styles.waveWrap}>
        {wavePoints.map((point, index) => {
          const barHeight = Math.max(8, Math.round(point * 96));
          return <View key={`wave-${index}`} style={[styles.waveBar, { height: barHeight }]} />;
        })}
      </View>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Fragmentos</Text>
          <Text style={styles.metricValue}>{capturedFragments}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Subidos</Text>
          <Text style={styles.metricValue}>{uploadedFragments}</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Pendientes</Text>
          <Text style={styles.metricValue}>{pendingUploads}</Text>
        </View>
      </View>

      <Text style={styles.microText}>Errores de red: {silentErrors}</Text>

      {isPreparing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={palette.mint} />
          <Text style={styles.loadingText}>Solicitando permisos de audio...</Text>
        </View>
      ) : null}

      {predictions.length > 0 && (
        <View style={styles.apneaSection}>
          <Text style={styles.apneaSectionTitle}>Predicciones de Apnea</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.predictionsScroll}
          >
            {predictions.map((pred, idx) => (
              <View key={`pred-${idx}`} style={styles.predictionCardWrapper}>
                <ApneaResultCard result={pred} />
              </View>
            ))}
          </ScrollView>
          <Text style={styles.spo2Info}>
            SpO2: {spo2Values.length > 0 ? spo2Values.join(', ') : 'N/A'}
          </Text>
        </View>
      )}

      {!permissionGranted ? (
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Volver</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.stopButton, !isMonitoring ? styles.stopButtonDisabled : null]}
          onPress={finishMonitoring}
          disabled={!isMonitoring}
        >
          <Text style={styles.stopButtonText}>Finalizar monitoreo</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
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
    color: palette.mint,
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
  sessionText: {
    marginTop: 14,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 34,
    lineHeight: 38,
  },
  modeText: {
    marginTop: 6,
    color: palette.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  statusText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  waveWrap: {
    marginTop: 26,
    height: 110,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  waveBar: {
    width: 7,
    borderRadius: 6,
    backgroundColor: palette.mint,
    opacity: 0.9,
  },
  metricRow: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
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
    fontSize: 24,
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
  stopButton: {
    marginTop: 'auto',
    borderRadius: 14,
    backgroundColor: palette.mint,
    alignItems: 'center',
    paddingVertical: 14,
  },
  stopButtonDisabled: {
    opacity: 0.55,
  },
  stopButtonText: {
    color: '#02120D',
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 'auto',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  apneaSection: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  apneaSectionTitle: {
    color: palette.mint,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  predictionsScroll: {
    marginHorizontal: -12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  predictionCardWrapper: {
    marginRight: 10,
    minWidth: 260,
  },
  spo2Info: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 10,
    lineHeight: 16,
  },
});

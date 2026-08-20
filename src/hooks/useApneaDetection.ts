import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { predictApnea, getApiErrorMessage } from "../services/api";

interface ApneaResult {
  nivel: "NORMAL" | "ALERTA" | "CRITICO";
  interpretacion: string;
  probabilidad: number;
  detalle: {
    prob_audio: number;
    prob_spo2: number;
    spo2_drop_pts: number;
    peso_audio: number;
    peso_spo2: number;
  };
  modo: string;
  perfil: string;
  version: string;
}

interface UseApneaDetectionOptions {
  modo?: string;
  perfil?: string;
  autoStart?: boolean;
}

interface UseApneaDetectionReturn {
  isRecording: boolean;
  isProcessing: boolean;
  result: ApneaResult | null;
  error: string;
  elapsedMs: number;
  progressPercent: number;
  startRecording: () => Promise<void>;
  stopAndPredict: (spo2Values?: number[]) => Promise<ApneaResult | undefined>;
  cancelRecording: () => Promise<void>;
  clearResult: () => void;
  levelColor: () => string;
  segmentDurationMs: number;
}

const RECORDING_OPTIONS = {
  isMeteringEnabled: false,
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 64000,
  android: {
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  },
} as const;

const SEGMENT_DURATION_MS = 30000;

export function useApneaDetection({
  modo = "screening",
  perfil = "general",
  autoStart = false,
}: UseApneaDetectionOptions = {}): UseApneaDetectionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ApneaResult | null>(null);
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);

  const recordingRef = useRef<typeof recorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);
  const recordingStartRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError("");
      setIsRecording(true);

      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Permiso de micrófono denegado");
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

      recordingRef.current = recorder;
      recordingStartRef.current = Date.now();

      clearTimer();
      timerRef.current = setInterval(() => {
        if (recordingStartRef.current && mountedRef.current) {
          setElapsedMs(Date.now() - recordingStartRef.current);
        }
      }, 100);
    } catch (err) {
      if (mountedRef.current) {
        setIsRecording(false);
        setError(
          getApiErrorMessage(err, "No fue posible iniciar la grabación"),
        );
      }
    }
  }, [clearTimer]);

  const stopAndPredict = useCallback(
    async (spo2Values: number[] = []): Promise<ApneaResult | undefined> => {
      try {
        if (!recordingRef.current) {
          throw new Error("No hay grabación activa");
        }

        clearTimer();

        await recordingRef.current.stop();
        const uri = recordingRef.current.uri;
        recordingRef.current = null;

        if (!uri) {
          throw new Error("No se pudo obtener la grabación");
        }

        setIsProcessing(true);

        const audioFile = {
          uri,
          type: "audio/mp4",
          name: "audio.m4a",
        };

        const spo2Str = spo2Values
          .map((val) => (typeof val === "number" ? val.toString() : val))
          .join(",");

        const prediction = await predictApnea({
          audioFile,
          spo2: spo2Str,
          modo,
          perfil,
        });

        if (mountedRef.current) {
          setResult(prediction);
          setError("");
        }

        return prediction;
      } catch (err) {
        const errorMsg = getApiErrorMessage(
          err,
          "Error al procesar la grabación",
        );
        if (mountedRef.current) {
          setError(errorMsg);
          setResult(null);
        }
        throw err;
      } finally {
        if (mountedRef.current) {
          setIsRecording(false);
          setIsProcessing(false);
          setElapsedMs(0);
          recordingStartRef.current = null;
        }

        clearTimer();

        try {
          await setAudioModeAsync({ allowsRecording: false });
        } catch {
          // ignore
        }
      }
    },
    [clearTimer, modo, perfil],
  );

  const cancelRecording = useCallback(async () => {
    try {
      clearTimer();

      if (recordingRef.current) {
        await recordingRef.current.stop();
        recordingRef.current = null;
      }

      if (mountedRef.current) {
        setIsRecording(false);
        setElapsedMs(0);
      }

      recordingStartRef.current = null;

      try {
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        // ignore
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(getApiErrorMessage(err, "Error al cancelar la grabación"));
      }
    }
  }, [clearTimer]);

  const clearResult = useCallback(() => {
    setResult(null);
    setError("");
  }, []);

  const levelColor = useCallback((): string => {
    if (!result) return "#999999";
    switch (result.nivel) {
      case "NORMAL":
        return "#10B981";
      case "ALERTA":
        return "#F59E0B";
      case "CRITICO":
        return "#EF4444";
      default:
        return "#999999";
    }
  }, [result]);

  const progressPercent = Math.min(
    100,
    (elapsedMs / SEGMENT_DURATION_MS) * 100,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (recordingRef.current) {
        recordingRef.current.stop().catch(() => {});
      }
    };
  }, [clearTimer]);

  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
  }, [autoStart, startRecording]);

  return {
    isRecording,
    isProcessing,
    result,
    error,
    elapsedMs,
    progressPercent,
    startRecording,
    stopAndPredict,
    cancelRecording,
    clearResult,
    levelColor,
    segmentDurationMs: SEGMENT_DURATION_MS,
  };
}

export default useApneaDetection;

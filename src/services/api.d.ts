import type { AxiosInstance } from "axios";
import type {
  AuthResponse,
  DetectionLog,
  SleepContinuityPoint,
  SleepSessionRecord,
  SleepSessionStartPayload,
} from "../types";

export interface AudioFileSource {
  uri: string;
  type?: string;
  name?: string;
}

export interface ApneaPredictionPayload {
  audioFile: AudioFileSource;
  spo2?: string;
  modo?: string;
  perfil?: string;
}

export interface ApneaPredictionFromFilePayload {
  fileUri: string;
  spo2?: string | number[];
  modo?: string;
  perfil?: string;
}

export interface ApneaPredictionResult {
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

export interface DashboardSummaryResponse {
  indicadores?: {
    sleep_score?: number;
    eventos_apnea_ronquido?: {
      ronquidos: number;
      apnea: number;
      total: number;
    };
    continuidad?: SleepContinuityPoint[];
  };
  disclaimer_medico?: string;
}

export interface UserProfile {
  user_id: string;
  nombre_completo: string;
  full_name?: string;
  email: string;
  activo: boolean;
  ronca_habitualmente: boolean | null;
  cansancio_diurno: boolean | null;
  riesgo_apnea_predicho?: string;
  apnea_risk?: string;
  acepta_consentimiento_datos?: boolean;
  email_verificado?: boolean;
  creado_en: string;
}

export interface StoredSessionData {
  token: string;
  user: UserProfile | null;
  expiresAt: number;
}

export function isAuthenticated(): boolean;
export function getApiErrorMessage(error: unknown, fallback?: string): string;
export function setAuthToken(token: string): void;
export function clearAuthToken(): void;
export function clearStoredSession(): Promise<void>;
export function saveStoredSession(data: StoredSessionData): Promise<void>;
export function getStoredSession(): Promise<StoredSessionData>;
export function subscribeTokenRefresh(
  handler: (token: string, user: UserProfile | null) => void,
): () => void;
export function refreshSession(): Promise<{
  token: string;
  expiresIn: number;
  user: UserProfile | null;
}>;
export function analyzeAudioMetadata(payload: unknown): Promise<unknown>;
export function registerUser(
  payload: Record<string, unknown>,
): Promise<AuthResponse>;
export function loginUser(
  payload: Record<string, unknown>,
): Promise<AuthResponse>;
export function socialLoginUser(
  payload: Record<string, unknown>,
): Promise<AuthResponse>;
export function getProfile(): Promise<UserProfile>;
export interface MessageResponse {
  ok: boolean;
  mensaje: string;
  verificacion_url_preview?: string;
}

export function sendEmailVerification(): Promise<MessageResponse>;
export function forgotPassword(email: string): Promise<MessageResponse>;
export function resetPassword(
  token: string,
  nuevaPassword: string,
): Promise<MessageResponse>;

export function deleteMyAccount(): Promise<{ status: number }>;
export function getDashboardSummary(): Promise<DashboardSummaryResponse>;
export function calibrateSleep(ambientNoiseLevel: number): Promise<unknown>;
export function startSleepSession(
  payload?: SleepSessionStartPayload,
): Promise<{ sesion: { session_id: string } }>;
export function uploadSleepFragment(params: {
  sessionId: string;
  fileUri: string;
  fragmentIndex: number;
  durationSeconds?: number;
  startedAt?: string;
}): Promise<unknown>;
export function finishSleepSession(
  sessionId: string,
  payload?: Record<string, unknown>,
): Promise<unknown>;
export function listSleepSessions(
  limit?: number,
): Promise<SleepSessionRecord[]>;
export function listSleepDetections(
  sessionId: string,
  limit?: number,
  cursor?: string,
): Promise<{
  items: DetectionLog[];
  next_cursor: string | null;
  has_more: boolean;
}>;
export function submitSleepFeedback(
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<unknown>;
export function predictApnea(
  params: ApneaPredictionPayload,
): Promise<ApneaPredictionResult>;
export function predictApneaFromFile(
  params: ApneaPredictionFromFilePayload,
): Promise<ApneaPredictionResult>;

declare const api: AxiosInstance;
export default api;

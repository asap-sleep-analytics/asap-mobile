export type MonitorMode = "cell_only" | "cell_oximeter";

export type ApneaLevel = "NORMAL" | "ALERTA" | "CRITICO";

export interface ApneaDetail {
  prob_audio: number;
  prob_spo2: number;
  spo2_drop_pts: number;
  peso_audio?: number;
  peso_spo2?: number;
}

export interface ApneaPrediction {
  nivel: ApneaLevel;
  interpretacion: string;
  probabilidad: number;
  detalle: ApneaDetail;
  modo: string;
  perfil: string;
  version: string;
}

export interface UserPublic {
  user_id: string;
  nombre_completo: string;
  email: string;
  activo: boolean;
  metodo_ingreso: string;
  ronca_habitualmente: boolean | null;
  cansancio_diurno: boolean | null;
  creado_en: string;
  email_verificado?: boolean;
}

export interface SocialLoginPayload {
  provider: "google" | "apple";
  id_token: string;
  nombre_completo?: string;
  ronca_habitualmente?: boolean;
  cansancio_diurno?: boolean;
  acepta_terminos_condiciones?: boolean;
  acepta_consentimiento_datos?: boolean;
  acepta_disclaimer_medico?: boolean;
}

export interface AuthResponse {
  mensaje: string;
  access_token: string;
  expires_in: number;
  usuario: UserPublic;
}

export interface SleepSessionRecord {
  session_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  snore_count: number;
  apnea_events: number;
  avg_oxygen: number | null;
  ambient_noise_level: number | null;
  sleep_score: number | null;
  model_source: string | null;
  model_version: string | null;
  analysis_label: string | null;
  continuidad: SleepContinuityPoint[];
  created_at: string;
}

export interface SleepContinuityPoint {
  minuto: number;
  estado: "deep_sleep" | "interrupcion";
}

export interface DashboardSummary {
  sleep_score: number;
  total_sessions: number;
  total_apnea_events: number;
  total_snore_events: number;
  continuity_timeline: SleepContinuityPoint[];
}

export interface DetectionLog {
  log_id: string;
  session_id: string;
  window_index: number;
  start_second: number;
  end_second: number;
  label: string;
  confidence_score: number;
  model_source: string;
  model_version: string;
  created_at: string;
}

export interface SleepFeedbackRequest {
  calificacion_descanso: number;
  desperto_cansado: boolean;
  comentario: string;
}

export interface SleepCalibrationResponse {
  mensaje: string;
  nivel_ruido: "optimo" | "moderado" | "alto";
  recomendacion: string;
}

export type TabName =
  "DashboardTab" | "MonitorTab" | "TipsTab" | "HistoryTab" | "ProfileTab";

export interface SleepDiaryEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  estimatedHours: number;
}

export interface ProfileSurveyData {
  edad: string;
  tipo_cuerpo: string;
  cuello_cm: string;
  cansancio_diurno: string;
  fumador: boolean;
  alcohol: string;
  actividad_fisica: string;
  medicamentos_sueno: boolean;
  comorbilidades: string[];
  updated_at?: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface EmergencyAlertSettings {
  enabled: boolean;
  severe_threshold_events: number;
  methods: {
    notification: boolean;
    whatsapp: boolean;
    sms: boolean;
    email: boolean;
    wake_alarm: boolean;
  };
  auto_dispatch: boolean;
  contacts: EmergencyContact[];
  updated_at?: string;
}

export interface SleepSessionStartPayload {
  start_time?: string;
  ambient_noise_level?: number;
}

export interface SleepSessionFinishPayload {
  end_time?: string;
  snore_count?: number;
  apnea_events?: number;
  ambient_noise_level?: number;
  avg_oxygen?: number;
}

export interface UploadFragmentParams {
  sessionId: string;
  fileUri: string;
  fragmentIndex: number;
  durationSeconds?: number;
  startedAt?: string;
}

export interface CalibrateSleepPayload {
  ambient_noise_level: number;
}

export interface OximeterDevice {
  id: string;
  name: string;
  rssi: number;
}

export interface ConnectedOximeter {
  id: string;
  name: string;
}

export interface OximeterReading {
  spo2: number | null;
  pulse: number | null;
  measuredAt: number | null;
}

export interface TipsProgressData {
  checked: string[];
  updated_at: string;
}

export interface TipsProgress {
  [moduleId: string]: TipsProgressData;
}

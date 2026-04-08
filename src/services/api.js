import axios from 'axios';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000';
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_BASE_URL || DEFAULT_BASE_URL;

let authToken = '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export function getApiErrorMessage(error, fallback = 'No fue posible completar la solicitud.') {
  if (error?.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error?.message) {
    return error.message;
  }
  return fallback;
}

export function setAuthToken(token) {
  authToken = token || '';
}

export function clearAuthToken() {
  authToken = '';
}

export async function analyzeAudioMetadata(payload) {
  const { data } = await api.post('/analyze', payload);
  return data;
}

export async function registerUser(payload) {
  const { data } = await api.post('/api/auth/registro', payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post('/api/auth/login', payload);
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/api/auth/perfil');
  return data;
}

export async function getDashboardSummary() {
  const { data } = await api.get('/api/dashboard/resumen');
  return data;
}

export async function calibrateSleep(ambientNoiseLevel) {
  const { data } = await api.post('/api/sleep/calibracion', {
    ambient_noise_level: ambientNoiseLevel,
  });
  return data;
}

export async function startSleepSession(payload = {}) {
  const { data } = await api.post('/api/sleep/sesiones/iniciar', payload);
  return data;
}

export async function uploadSleepFragment({ sessionId, fileUri, fragmentIndex, durationSeconds, startedAt }) {
  const formData = new FormData();
  formData.append('fragmento', {
    uri: fileUri,
    name: `fragmento_${String(fragmentIndex).padStart(5, '0')}.m4a`,
    type: 'audio/mp4',
  });
  formData.append('fragment_index', String(fragmentIndex));

  if (durationSeconds !== undefined && durationSeconds !== null) {
    formData.append('duration_seconds', String(durationSeconds));
  }

  if (startedAt) {
    formData.append('started_at', startedAt);
  }

  const { data } = await api.post(`/api/sleep/sesiones/${sessionId}/fragmento`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 25000,
  });
  return data;
}

export async function finishSleepSession(sessionId, payload = {}) {
  const { data } = await api.post(`/api/sleep/sesiones/${sessionId}/finalizar`, payload);
  return data;
}

export async function listSleepSessions(limit = 20) {
  const { data } = await api.get('/api/sleep/sesiones', {
    params: { limit },
  });
  return data;
}

export async function listSleepDetections(sessionId, limit = 720) {
  const { data } = await api.get(`/api/sleep/sesiones/${sessionId}/detecciones`, {
    params: { limit },
  });
  return data;
}

export async function submitSleepFeedback(sessionId, payload) {
  const { data } = await api.post(`/api/sleep/sesiones/${sessionId}/feedback`, payload);
  return data;
}

export default api;

import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000";
const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_BASE_URL ||
  DEFAULT_BASE_URL;

const isProduction =
  Constants?.appOwnership === "expo" ||
  Constants?.executionEnvironment === "standalone";

export const AUTH_TOKEN_KEY = "asap.auth.token";
export const AUTH_USER_KEY = "asap.auth.user";
export const AUTH_EXPIRES_AT_KEY = "asap.auth.expiresAt";

let authToken = "";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const url = config.baseURL || "";
  if (isProduction && url.startsWith("http://")) {
    console.warn(
      "⚠️ CONEXIÓN NO SEGURA: El API está usando HTTP en producción. Usa HTTPS para conexiones seguras.",
    );
  }
  return config;
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export function isAuthenticated() {
  return authToken.length > 0;
}

const HTTP_ERROR_MESSAGES = {
  400: "Revisa la información ingresada e inténtalo de nuevo.",
  401: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
  403: "No tienes permiso para realizar esta acción.",
  404: "No encontramos lo que buscabas.",
  409: "Ya existe un registro con esos datos.",
  422: "Algunos datos no son válidos. Revísalos e inténtalo de nuevo.",
  429: "Hiciste demasiadas solicitudes. Espera unos segundos e inténtalo de nuevo.",
  500: "Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.",
  502: "El servidor no está disponible en este momento. Inténtalo de nuevo más tarde.",
  503: "Estamos en mantenimiento. Inténtalo de nuevo en unos minutos.",
  504: "El servidor tardó demasiado en responder. Verifica tu conexión e inténtalo de nuevo.",
};

export function getApiErrorMessage(
  error,
  fallback = "No fue posible completar la solicitud.",
) {
  if (
    error?.response?.data?.detail &&
    typeof error.response.data.detail === "string" &&
    error.response.data.detail.trim()
  ) {
    return error.response.data.detail;
  }
  const status = error?.response?.status;
  if (typeof status === "number" && HTTP_ERROR_MESSAGES[status]) {
    return HTTP_ERROR_MESSAGES[status];
  }
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    return "El servidor tardó demasiado en responder. Verifica tu conexión a internet e inténtalo de nuevo.";
  }
  if (
    error?.code === "ERR_NETWORK" ||
    error?.code === "ECONNREFUSED" ||
    error?.code === "ENOTFOUND"
  ) {
    return "No pudimos conectarnos con el servidor. Verifica tu conexión a internet e inténtalo de nuevo.";
  }
  if (error?.message) {
    return error.message;
  }
  return fallback;
}

export function setAuthToken(token) {
  authToken = token || "";
}

export function clearAuthToken() {
  authToken = "";
}

export async function clearStoredSession() {
  authToken = "";
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
    SecureStore.deleteItemAsync(AUTH_USER_KEY),
    SecureStore.deleteItemAsync(AUTH_EXPIRES_AT_KEY),
  ]);
}

export async function saveStoredSession({ token, user = null, expiresAt = 0 }) {
  await Promise.all([
    SecureStore.setItemAsync(AUTH_TOKEN_KEY, token || ""),
    SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user || null)),
    SecureStore.setItemAsync(
      AUTH_EXPIRES_AT_KEY,
      String(Number(expiresAt) || 0),
    ),
  ]);
}

export async function getStoredSession() {
  const [token, userJson, expiresAtValue] = await Promise.all([
    SecureStore.getItemAsync(AUTH_TOKEN_KEY),
    SecureStore.getItemAsync(AUTH_USER_KEY),
    SecureStore.getItemAsync(AUTH_EXPIRES_AT_KEY),
  ]);

  let user = null;
  if (userJson) {
    try {
      const parsed = JSON.parse(userJson);
      if (parsed && typeof parsed === "object") {
        user = parsed;
      }
    } catch {
      user = null;
    }
  }

  return {
    token: token || "",
    user,
    expiresAt: Number(expiresAtValue) || 0,
  };
}

const AUTO_REFRESHED = "__asapAutoRefreshed";

const tokenRefreshHandlers = new Set();

export function subscribeTokenRefresh(handler) {
  tokenRefreshHandlers.add(handler);
  return () => tokenRefreshHandlers.delete(handler);
}

function notifySessionChanged(token, user = null) {
  tokenRefreshHandlers.forEach((handler) => {
    try {
      handler(token, user);
    } catch {
      // Los suscriptores no deben romper el flujo de autenticación.
    }
  });
}

async function refreshAccessTokenOnce() {
  if (!authToken) {
    throw new Error("No hay sesión activa para renovar.");
  }

  const { data } = await api.post("/api/v1/auth/refresh");
  const nextToken = data?.access_token;
  if (!nextToken) {
    throw new Error("El servidor no devolvió un token renovado.");
  }

  const expiresAt =
    Date.now() + Math.max(Number(data.expires_in) || 0, 1) * 1000;
  const user = data.usuario || null;

  authToken = nextToken;
  await saveStoredSession({ token: nextToken, user, expiresAt });
  notifySessionChanged(nextToken, user);

  return { token: nextToken, expiresIn: Number(data.expires_in) || 0, user };
}

export async function refreshSession() {
  return refreshAccessTokenOnce();
}

async function endSessionLocally() {
  await clearStoredSession();
  notifySessionChanged("", null);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const originalUrl = typeof config?.url === "string" ? config.url : "";

    const isAuthHandshake =
      originalUrl.includes("/auth/login") ||
      originalUrl.includes("/auth/registro") ||
      originalUrl.includes("/auth/social/login") ||
      originalUrl.includes("/auth/refresh");

    if (
      response?.status !== 401 ||
      !config ||
      config[AUTO_REFRESHED] ||
      isAuthHandshake
    ) {
      return Promise.reject(error);
    }

    config[AUTO_REFRESHED] = true;

    try {
      await refreshAccessTokenOnce();
      return api.request(config);
    } catch {
      await endSessionLocally();
      return Promise.reject(error);
    }
  },
);

export async function analyzeAudioMetadata(payload) {
  const { data } = await api.post("/api/v1/analyze", payload);
  return data;
}

export async function registerUser(payload) {
  const { data } = await api.post("/api/v1/auth/registro", payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post("/api/v1/auth/login", payload);
  return data;
}

export async function socialLoginUser(payload) {
  const { data } = await api.post("/api/v1/auth/social/login", payload);
  return data;
}

export async function getProfile() {
  const { data } = await api.get("/api/v1/auth/perfil");
  return data;
}

export async function deleteMyAccount() {
  const { status } = await api.delete("/api/v1/auth/cuenta");
  return { status };
}

export async function sendEmailVerification() {
  const { data } = await api.post("/api/v1/auth/email/enviar-verificacion");
  return data;
}

export async function forgotPassword(email) {
  const { data } = await api.post("/api/v1/auth/password/olvidada", { email });
  return data;
}

export async function resetPassword(token, nuevaPassword) {
  const { data } = await api.post("/api/v1/auth/password/restablecer", {
    token,
    nueva_password: nuevaPassword,
  });
  return data;
}

export async function getDashboardSummary() {
  const { data } = await api.get("/api/v1/dashboard/resumen");
  return data;
}

export async function calibrateSleep(ambientNoiseLevel) {
  const { data } = await api.post("/api/v1/sleep/calibracion", {
    ambient_noise_level: ambientNoiseLevel,
  });
  return data;
}

export async function startSleepSession(payload = {}) {
  const { data } = await api.post("/api/v1/sleep/sesiones/iniciar", payload);
  return data;
}

export async function uploadSleepFragment({
  sessionId,
  fileUri,
  fragmentIndex,
  durationSeconds,
  startedAt,
}) {
  const formData = new FormData();
  formData.append("fragmento", {
    uri: fileUri,
    name: `fragmento_${String(fragmentIndex).padStart(5, "0")}.m4a`,
    type: "audio/mp4",
  });
  formData.append("fragment_index", String(fragmentIndex));

  if (durationSeconds !== undefined && durationSeconds !== null) {
    formData.append("duration_seconds", String(durationSeconds));
  }

  if (startedAt) {
    formData.append("started_at", startedAt);
  }

  const { data } = await api.post(
    `/api/v1/sleep/sesiones/${sessionId}/fragmento`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 25000,
    },
  );
  return data;
}

export async function finishSleepSession(sessionId, payload = {}) {
  const { data } = await api.post(
    `/api/v1/sleep/sesiones/${sessionId}/finalizar`,
    payload,
  );
  return data;
}

export async function listSleepSessions(limit = 20) {
  const { data } = await api.get("/api/v1/sleep/sesiones", {
    params: { limit },
  });
  return Array.isArray(data) ? data : data?.items || [];
}

export async function listSleepDetections(sessionId, limit = 720, cursor) {
  const { data } = await api.get(
    `/api/v1/sleep/sesiones/${sessionId}/detecciones`,
    {
      params: { limit, cursor },
    },
  );
  const items = Array.isArray(data) ? data : data?.items || [];
  return {
    items,
    nextCursor: data?.next_cursor ?? null,
    hasMore: Boolean(data?.has_more),
  };
}

export async function submitSleepFeedback(sessionId, payload) {
  const { data } = await api.post(
    `/api/v1/sleep/sesiones/${sessionId}/feedback`,
    payload,
  );
  return data;
}

/**
 * Predice apnea del sueño usando audio + SpO2
 * @param {Object} params
 * @param {File|Blob} params.audioFile - Archivo WAV de 30 segundos
 * @param {string} params.spo2 - Valores SpO2 separados por coma (ej: "95,94,93,91")
 * @param {string} [params.modo='screening'] - Modo clínico: 'screening' o 'seguimiento'
 * @param {string} [params.perfil='general'] - Perfil del paciente: 'general' o 'matias'
 * @returns {Promise<Object>} Predicción con nivel (NORMAL/ALERTA/CRÍTICO), probabilidad e interpretación
 */
export async function predictApnea({
  audioFile,
  spo2,
  modo = "screening",
  perfil = "general",
}) {
  const formData = new FormData();
  formData.append("audio", audioFile, audioFile.name || "audio.m4a");

  const spo2Str = Array.isArray(spo2)
    ? spo2.map((v) => v.toString()).join(",")
    : spo2;
  const params = { modo, perfil };
  if (spo2Str && String(spo2Str).trim().length > 0) {
    params.spo2 = spo2Str;
  }

  const { data } = await api.post("/api/v1/sleep/v3/predict", formData, {
    params,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 30000,
  });

  return data;
}

/**
 * Predice apnea desde un archivo ya grabado (por URI local)
 * Usado en MonitorActiveScreen para enviar fragmentos
 * @param {Object} params
 * @param {string} params.fileUri - URI local del archivo de audio (ej: file://...)
 * @param {string|Array<number>} params.spo2 - Valores SpO2 (array o string "95,94,93,91")
 * @param {string} [params.modo='screening'] - Modo clínico
 * @param {string} [params.perfil='general'] - Perfil del paciente
 * @returns {Promise<Object>} Predicción
 */
export async function predictApneaFromFile({
  fileUri,
  spo2,
  modo = "screening",
  perfil = "general",
}) {
  const formData = new FormData();

  const spo2Str = Array.isArray(spo2)
    ? spo2.map((v) => v.toString()).join(",")
    : spo2;
  const params = { modo, perfil };
  if (spo2Str && String(spo2Str).trim().length > 0) {
    params.spo2 = spo2Str;
  }

  formData.append("audio", {
    uri: fileUri,
    type: "audio/m4a",
    name: "audio.m4a",
  });

  const { data } = await api.post("/api/v1/sleep/v3/predict", formData, {
    params,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    timeout: 30000,
  });

  return data;
}

export default api;

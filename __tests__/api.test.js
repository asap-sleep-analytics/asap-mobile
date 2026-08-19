import axios from "axios";

import {
  analyzeAudioMetadata,
  clearAuthToken,
  finishSleepSession,
  getApiErrorMessage,
  getDashboardSummary,
  getProfile,
  isAuthenticated,
  listSleepDetections,
  listSleepSessions,
  loginUser,
  predictApnea,
  registerUser,
  socialLoginUser,
  setAuthToken,
  startSleepSession,
  submitSleepFeedback,
  uploadSleepFragment,
} from "../src/services/api";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: "storeClient" },
}));

jest.mock("axios", () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  const create = jest.fn(() => instance);
  create.__instance = instance;
  return {
    __esModule: true,
    default: { create },
  };
});

const mockedPost = axios.create.__instance.post;
const mockedGet = axios.create.__instance.get;

describe("api error messages", () => {
  it("usa el detail del backend cuando existe", () => {
    const error = { response: { data: { detail: "Correo ya registrado." } } };
    expect(getApiErrorMessage(error)).toBe("Correo ya registrado.");
  });

  it("el detail del backend tiene prioridad sobre el mensaje del status", () => {
    const error = {
      response: {
        status: 401,
        data: {
          detail:
            "Debes aceptar los términos y condiciones para crear la cuenta.",
        },
      },
    };
    expect(getApiErrorMessage(error)).toBe(
      "Debes aceptar los términos y condiciones para crear la cuenta.",
    );
  });

  it("usa error.message si no hay detail", () => {
    const error = { message: "Network Error" };
    expect(getApiErrorMessage(error)).toBe("Network Error");
  });

  it("usa el fallback si no hay nada útil", () => {
    expect(getApiErrorMessage({})).toBe(
      "No fue posible completar la solicitud.",
    );
    expect(getApiErrorMessage(null, "fallback propio")).toBe("fallback propio");
  });

  it("si detail es string vacío, cae al message", () => {
    const error = { response: { data: { detail: "" } }, message: "timeout" };
    expect(getApiErrorMessage(error)).toBe("timeout");
  });
});

describe("auth token", () => {
  beforeEach(() => {
    clearAuthToken();
  });

  it("isAuthenticated refleja el estado del token", () => {
    expect(isAuthenticated()).toBe(false);
    setAuthToken("abc.def.ghi");
    expect(isAuthenticated()).toBe(true);
    clearAuthToken();
    expect(isAuthenticated()).toBe(false);
  });

  it("setAuthToken con valor vacío limpia", () => {
    setAuthToken("token");
    setAuthToken("");
    expect(isAuthenticated()).toBe(false);
  });
});

describe("endpoints de autenticación", () => {
  it("registerUser hace POST a /api/v1/auth/registro", async () => {
    mockedPost.mockResolvedValueOnce({ data: { id: "u1" } });
    const result = await registerUser({ email: "a@b.com", password: "x" });
    expect(mockedPost).toHaveBeenCalledWith("/api/v1/auth/registro", {
      email: "a@b.com",
      password: "x",
    });
    expect(result).toEqual({ id: "u1" });
  });

  it("loginUser hace POST a /api/v1/auth/login", async () => {
    mockedPost.mockResolvedValueOnce({ data: { token: "t" } });
    await loginUser({ email: "a@b.com", password: "x" });
    expect(mockedPost).toHaveBeenCalledWith("/api/v1/auth/login", {
      email: "a@b.com",
      password: "x",
    });
  });

  it("socialLoginUser hace POST a /api/v1/auth/social/login", async () => {
    mockedPost.mockResolvedValueOnce({ data: { token: "social" } });
    const payload = {
      provider: "google",
      id_token: "id-token",
      acepta_terminos_condiciones: true,
    };
    const result = await socialLoginUser(payload);
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/v1/auth/social/login",
      payload,
    );
    expect(result).toEqual({ token: "social" });
  });

  it("getProfile hace GET a /api/v1/auth/perfil", async () => {
    mockedGet.mockResolvedValueOnce({ data: { full_name: "Ana" } });
    const result = await getProfile();
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/auth/perfil");
    expect(result).toEqual({ full_name: "Ana" });
  });
});

describe("endpoints de sleep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("startSleepSession hace POST a /api/v1/sleep/sesiones/iniciar", async () => {
    mockedPost.mockResolvedValueOnce({ data: { session_id: "s1" } });
    const result = await startSleepSession({ modo: "cell_only" });
    expect(mockedPost).toHaveBeenCalledWith("/api/v1/sleep/sesiones/iniciar", {
      modo: "cell_only",
    });
    expect(result).toEqual({ session_id: "s1" });
  });

  it("finishSleepSession usa el sessionId en la URL", async () => {
    mockedPost.mockResolvedValueOnce({ data: { status: "done" } });
    await finishSleepSession("s-123", { duracion: 10 });
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/v1/sleep/sesiones/s-123/finalizar",
      {
        duracion: 10,
      },
    );
  });

  it("listSleepSessions pasa limit como query param", async () => {
    mockedGet.mockResolvedValueOnce({ data: { sessions: [] } });
    await listSleepSessions(30);
    expect(mockedGet).toHaveBeenCalledWith("/api/v1/sleep/sesiones", {
      params: { limit: 30 },
    });
  });

  it("listSleepDetections usa sessionId y limit", async () => {
    mockedGet.mockResolvedValueOnce({ data: [] });
    await listSleepDetections("s-9", 100);
    expect(mockedGet).toHaveBeenCalledWith(
      "/api/v1/sleep/sesiones/s-9/detecciones",
      {
        params: { limit: 100 },
      },
    );
  });

  it("submitSleepFeedback hace POST al feedback de la sesión", async () => {
    mockedPost.mockResolvedValueOnce({ data: { ok: true } });
    await submitSleepFeedback("s-1", { valoracion: 4 });
    expect(mockedPost).toHaveBeenCalledWith(
      "/api/v1/sleep/sesiones/s-1/feedback",
      {
        valoracion: 4,
      },
    );
  });
});

describe("uploadSleepFragment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("construye FormData con el fragmento y envia multipart", async () => {
    mockedPost.mockResolvedValueOnce({ data: { fragment_index: 0 } });

    await uploadSleepFragment({
      sessionId: "s-1",
      fileUri: "file:///tmp/frag.m4a",
      fragmentIndex: 0,
      durationSeconds: 300,
      startedAt: "2026-01-01T00:00:00Z",
    });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockedPost.mock.calls[0];
    expect(url).toBe("/api/v1/sleep/sesiones/s-1/fragmento");
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
    expect(config.timeout).toBe(25000);
    expect(body).toBeInstanceOf(FormData);
    const names = Array.from(body.keys());
    expect(names).toEqual(
      expect.arrayContaining([
        "fragmento",
        "fragment_index",
        "duration_seconds",
        "started_at",
      ]),
    );
  });

  it("omite duration_seconds y started_at cuando no se pasan", async () => {
    mockedPost.mockResolvedValueOnce({ data: {} });
    await uploadSleepFragment({
      sessionId: "s-1",
      fileUri: "file:///tmp/frag.m4a",
      fragmentIndex: 3,
    });

    const body = mockedPost.mock.calls[0][1];
    expect(body).toBeInstanceOf(FormData);
  });
});

describe("predictApnea", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hace POST multipart a /api/v1/sleep/v3/predict con params", async () => {
    mockedPost.mockResolvedValueOnce({ data: { nivel: "NORMAL" } });

    const result = await predictApnea({
      audioFile: new Blob(["fake-wav-data"], { type: "audio/wav" }),
      spo2: "95,94,93",
      modo: "seguimiento",
      perfil: "matias",
    });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, , config] = mockedPost.mock.calls[0];
    expect(url).toBe("/api/v1/sleep/v3/predict");
    expect(config.params).toEqual({
      spo2: "95,94,93",
      modo: "seguimiento",
      perfil: "matias",
    });
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
    expect(config.timeout).toBe(30000);
    expect(result).toEqual({ nivel: "NORMAL" });
  });
});

describe("analyzeAudioMetadata", () => {
  it("hace POST a /api/v1/analyze", async () => {
    mockedPost.mockResolvedValueOnce({ data: { ok: true } });
    await analyzeAudioMetadata({ duracion: 3 });
    expect(mockedPost).toHaveBeenCalledWith("/api/v1/analyze", { duracion: 3 });
  });
});

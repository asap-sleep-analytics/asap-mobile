import axios from "axios";

import {
  getApiErrorMessage,
  refreshSession,
  setAuthToken,
  subscribeTokenRefresh,
} from "../src/services/api";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: "storeClient" },
}));

jest.mock("expo-secure-store", () => ({
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
  getItemAsync: jest.fn(async () => null),
}));

jest.mock("axios", () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    request: jest.fn(),
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

const instance = axios.create.__instance;
const mockedPost = instance.post;

let notifiedToken = null;
let notifiedUser = null;
subscribeTokenRefresh((token, user) => {
  notifiedToken = token;
  notifiedUser = user;
});

beforeEach(() => {
  setAuthToken("token-activo");
  mockedPost.mockReset();
  instance.request.mockReset();
  notifiedToken = null;
  notifiedUser = null;
});

function captureUnauthorizedHandler() {
  const handlers = instance.interceptors.response.use.mock.calls;
  expect(handlers.length).toBeGreaterThan(0);
  return handlers[handlers.length - 1][1];
}

function buildError(status, url) {
  return {
    response: { status },
    config: { url },
  };
}

describe("auto refresh de token en 401", () => {
  it("renueva el token y reintenta la petición original", async () => {
    mockedPost.mockResolvedValueOnce({
      data: {
        access_token: "token-nuevo-123",
        expires_in: 900,
        usuario: { user_id: "u1", email: "x@y.com" },
      },
    });
    instance.request.mockResolvedValueOnce({ data: { sesiones: [] } });

    const onRejected = captureUnauthorizedHandler();
    const result = await onRejected(buildError(401, "/api/v1/sleep/sesiones"));

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/auth/refresh");
    expect(instance.request).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ sesiones: [] });
    expect(notifiedToken).toBe("token-nuevo-123");
    expect(notifiedUser).toEqual({ user_id: "u1", email: "x@y.com" });
  });

  it("no reintenta dos veces sobre la misma petición", async () => {
    mockedPost.mockResolvedValueOnce({
      data: { access_token: "token-2", expires_in: 900, usuario: null },
    });
    instance.request.mockRejectedValueOnce(buildError(401, "/api/v1/perfil"));

    const onRejected = captureUnauthorizedHandler();
    await expect(
      onRejected(buildError(401, "/api/v1/perfil")),
    ).rejects.toBeDefined();

    expect(instance.request).toHaveBeenCalledTimes(1);
  });

  it("no intenta renovar en login, registro ni refresh", async () => {
    const onRejected = captureUnauthorizedHandler();

    await expect(
      onRejected(buildError(401, "/api/v1/auth/login")),
    ).rejects.toBeDefined();
    await expect(
      onRejected(buildError(401, "/api/v1/auth/social/login")),
    ).rejects.toBeDefined();
    await expect(
      onRejected(buildError(401, "/api/v1/auth/refresh")),
    ).rejects.toBeDefined();

    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("si el refresh falla, cierra la sesión localmente", async () => {
    mockedPost.mockRejectedValueOnce(buildError(401, "/api/v1/auth/refresh"));

    const onRejected = captureUnauthorizedHandler();
    await expect(
      onRejected(buildError(401, "/api/v1/sleep/perfil")),
    ).rejects.toBeDefined();

    expect(notifiedToken).toBe("");
  });

  it("ignora errores que no son 401", async () => {
    const onRejected = captureUnauthorizedHandler();
    const error = buildError(500, "/api/v1/algo");

    await expect(onRejected(error)).rejects.toBe(error);
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe("refreshSession", () => {
  it("devuelve token renovado y notifica", async () => {
    setAuthToken("token-viejo");
    mockedPost.mockResolvedValueOnce({
      data: {
        access_token: "token-renovado",
        expires_in: 600,
        usuario: { user_id: "u2" },
      },
    });

    const result = await refreshSession();
    expect(result.token).toBe("token-renovado");
    expect(result.expiresIn).toBe(600);
    expect(notifiedToken).toBe("token-renovado");
  });

  it("getApiErrorMessage conserva el detail del backend", () => {
    const error = {
      response: { status: 401, data: { detail: "Sesión vencida." } },
    };
    expect(getApiErrorMessage(error)).toBe("Sesión vencida.");
  });
});

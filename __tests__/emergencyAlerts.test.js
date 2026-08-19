import { Alert, Linking, Vibration } from "react-native";

import { triggerSevereApneaAlert } from "../src/services/emergencyAlerts";

const mockConstants = {
  appOwnership: null,
  executionEnvironment: "standalone",
};

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: mockConstants,
}));

jest.mock("expo-notifications", () => ({
  __esModule: true,
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  scheduleNotificationAsync: jest.fn(async () => "id-1"),
  AndroidNotificationPriority: { MAX: "max" },
}));

import * as Notifications from "expo-notifications";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
  Linking: {
    canOpenURL: jest.fn(async () => true),
    openURL: jest.fn(async () => undefined),
  },
  Vibration: { vibrate: jest.fn() },
  Platform: {
    OS: "ios",
    select: (specifics) =>
      specifics.ios !== undefined ? specifics.ios : specifics.default,
  },
}));

const canOpenURL = Linking.canOpenURL;
const openURL = Linking.openURL;

const BASE_SETTINGS = {
  enabled: true,
  severe_threshold_events: 8,
  methods: {
    notification: true,
    whatsapp: false,
    sms: false,
    email: false,
    wake_alarm: false,
  },
  auto_dispatch: true,
  contacts: [],
};

describe("triggerSevereApneaAlert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no hace nada si está deshabilitado", async () => {
    const result = await triggerSevereApneaAlert(
      { ...BASE_SETTINGS, enabled: false },
      { sessionId: "s1" },
    );
    expect(result).toEqual({ triggered: false, reason: "disabled" });
    expect(Vibration.vibrate).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("vibra y notifica si los métodos están activos", async () => {
    const settings = {
      ...BASE_SETTINGS,
      methods: {
        ...BASE_SETTINGS.methods,
        wake_alarm: true,
        notification: true,
      },
    };
    const result = await triggerSevereApneaAlert(settings, { sessionId: "s1" });

    expect(Vibration.vibrate).toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    expect(result).toEqual({ triggered: true });
  });

  it("no envía notificación si no se da permiso", async () => {
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });
    await triggerSevereApneaAlert(
      {
        ...BASE_SETTINGS,
        methods: { ...BASE_SETTINGS.methods, notification: true },
      },
      { sessionId: "s1" },
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("muestra Alert cuando auto_dispatch es false", async () => {
    await triggerSevereApneaAlert(
      { ...BASE_SETTINGS, auto_dispatch: false, contacts: [{ phone: "123" }] },
      { sessionId: "s1" },
    );
    expect(Alert.alert).toHaveBeenCalled();
  });

  it("envía WhatsApp cuando el contacto lo permite", async () => {
    canOpenURL.mockResolvedValueOnce(true);
    await triggerSevereApneaAlert(
      {
        ...BASE_SETTINGS,
        methods: { ...BASE_SETTINGS.methods, whatsapp: true },
        contacts: [{ phone: "573001234567" }],
      },
      { sessionId: "s1", estimatedEvents: 12 },
    );

    expect(openURL).toHaveBeenCalledTimes(1);
    const url = openURL.mock.calls[0][0];
    expect(url.startsWith("whatsapp://send?phone=")).toBe(true);
    expect(url).toContain(encodeURIComponent("ALERTA A.S.A.P."));
  });

  it("cae a SMS si WhatsApp no está disponible", async () => {
    canOpenURL.mockResolvedValueOnce(false);
    await triggerSevereApneaAlert(
      {
        ...BASE_SETTINGS,
        methods: { ...BASE_SETTINGS.methods, whatsapp: true, sms: true },
        contacts: [{ phone: "573001234567" }],
      },
      { sessionId: "s1" },
    );

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL.mock.calls[0][0].startsWith("sms:")).toBe(true);
  });

  it("cae a email si no hay teléfono", async () => {
    await triggerSevereApneaAlert(
      {
        ...BASE_SETTINGS,
        methods: { ...BASE_SETTINGS.methods, sms: true, email: true },
        contacts: [{ email: "x@example.com" }],
      },
      { sessionId: "s1" },
    );

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL.mock.calls[0][0].startsWith("mailto:")).toBe(true);
  });

  it("no intenta contactos sin datos útiles", async () => {
    await triggerSevereApneaAlert(
      {
        ...BASE_SETTINGS,
        methods: { ...BASE_SETTINGS.methods, sms: true, whatsapp: true },
      },
      { sessionId: "s1" },
    );
    expect(openURL).not.toHaveBeenCalled();
  });

  it("no falla si openURL lanza error", async () => {
    openURL.mockRejectedValueOnce(new Error("boom"));
    await expect(
      triggerSevereApneaAlert(
        {
          ...BASE_SETTINGS,
          methods: { ...BASE_SETTINGS.methods, sms: true },
          contacts: [{ phone: "123" }],
        },
        { sessionId: "s1" },
      ),
    ).resolves.toEqual({ triggered: true });
  });
});

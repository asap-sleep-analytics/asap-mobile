jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __esModule: true,
    getItemAsync: jest.fn(async (key) =>
      store.has(key) ? store.get(key) : null,
    ),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    __store: store,
  };
});

import * as SecureStore from "expo-secure-store";

// El namespace importado expone `__store` solo a través del mock de jest.
// eslint-disable-next-line import/namespace
const store = SecureStore.__store;

import {
  clearPreferredOximeterDevice,
  getAppInactivityWindows,
  getEmergencyAlertSettings,
  getMonitorHintsHidden,
  getPreferredMonitorMode,
  getPreferredOximeterDevice,
  getProfileSurvey,
  getTipsProgress,
  listSleepDiaryEntries,
  recordAppInactivityWindow,
  saveEmergencyAlertSettings,
  savePreferredMonitorMode,
  savePreferredOximeterDevice,
  saveProfileSurvey,
  saveSleepDiaryEntry,
  saveTipsProgress,
  setMonitorHintsHidden,
} from "../src/services/localHealth";

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
});

describe("monitor hints", () => {
  it("getMonitorHintsHidden devuelve false sin valor guardado", async () => {
    expect(await getMonitorHintsHidden()).toBe(false);
  });

  it("set/get redondean el hint", async () => {
    await setMonitorHintsHidden(true);
    expect(await getMonitorHintsHidden()).toBe(true);
    await setMonitorHintsHidden(false);
    expect(await getMonitorHintsHidden()).toBe(false);
  });
});

describe("sleep diary", () => {
  it("listSleepDiaryEntries devuelve [] sin datos", async () => {
    expect(await listSleepDiaryEntries()).toEqual([]);
  });

  it("saveSleepDiaryEntry antepone y reemplaza por fecha", async () => {
    const entryA = { date: "2026-08-01", horas: 7 };
    const entryB = { date: "2026-08-02", horas: 8 };
    const result1 = await saveSleepDiaryEntry(entryA);
    const result2 = await saveSleepDiaryEntry(entryB);

    expect(result2[0]).toEqual(entryB);
    expect(result2[1]).toEqual(entryA);
    expect(await listSleepDiaryEntries()).toEqual(result2);
  });

  it("saveSleepDiaryEntry actualiza una fecha existente en vez de duplicar", async () => {
    await saveSleepDiaryEntry({ date: "2026-08-01", horas: 6 });
    const updated = await saveSleepDiaryEntry({ date: "2026-08-01", horas: 9 });
    expect(updated.filter((e) => e.date === "2026-08-01")).toHaveLength(1);
    expect(updated[0]).toEqual({ date: "2026-08-01", horas: 9 });
  });

  it("mantiene a lo sumo 30 entradas", async () => {
    for (let i = 0; i < 40; i += 1) {
      await saveSleepDiaryEntry({
        date: `2026-08-${String(i).padStart(2, "0")}`,
        horas: 7,
      });
    }
    const entries = await listSleepDiaryEntries();
    expect(entries).toHaveLength(30);
  });
});

describe("profile survey", () => {
  it("devuelve null sin encuesta", async () => {
    expect(await getProfileSurvey()).toBeNull();
  });

  it("save/get persisten con updated_at", async () => {
    const saved = await saveProfileSurvey({ ronca: true });
    expect(saved.ronca).toBe(true);
    expect(typeof saved.updated_at).toBe("string");
    const loaded = await getProfileSurvey();
    expect(loaded.ronca).toBe(true);
  });
});

describe("tips progress", () => {
  it("getTipsProgress devuelve {} sin datos", async () => {
    expect(await getTipsProgress()).toEqual({});
  });

  it("saveTipsProgress agrega modulo sin perder los demás", async () => {
    await saveTipsProgress("mod-a", ["x1", "x2"]);
    const result = await saveTipsProgress("mod-b", ["y1"]);

    expect(result).toEqual({ checked: ["y1"], updated_at: expect.any(String) });
    const progress = await getTipsProgress();
    expect(progress["mod-a"].checked).toEqual(["x1", "x2"]);
    expect(progress["mod-b"].checked).toEqual(["y1"]);
  });

  it("guarda array vacío si checkedItems no es array", async () => {
    const result = await saveTipsProgress("mod-c", "no-array");
    expect(result.checked).toEqual([]);
  });
});

describe("oximeter device", () => {
  it("null por defecto y roundtrip", async () => {
    expect(await getPreferredOximeterDevice()).toBeNull();
    await savePreferredOximeterDevice({ id: "dev-1" });
    expect(await getPreferredOximeterDevice()).toEqual({ id: "dev-1" });
    await clearPreferredOximeterDevice();
    expect(await getPreferredOximeterDevice()).toBeNull();
  });
});

describe("monitor mode", () => {
  it("default cell_only", async () => {
    expect(await getPreferredMonitorMode()).toBe("cell_only");
  });

  it("normaliza valores inválidos a cell_only", async () => {
    await savePreferredMonitorMode("otra-cosa");
    expect(await getPreferredMonitorMode()).toBe("cell_only");
  });

  it("roundtrip cell_oximeter", async () => {
    await savePreferredMonitorMode("cell_oximeter");
    expect(await getPreferredMonitorMode()).toBe("cell_oximeter");
  });
});

describe("app inactivity windows", () => {
  it("devuelve [] sin datos", async () => {
    expect(await getAppInactivityWindows()).toEqual([]);
  });

  it("recordAppInactivityWindow antepone y limita a 60", async () => {
    const window = {
      background_at: "t1",
      foreground_at: "t2",
      duration_minutes: 5,
    };
    const result = await recordAppInactivityWindow(window);
    expect(result[0]).toMatchObject(window);
    expect(typeof result[0].id).toBe("string");

    for (let i = 0; i < 70; i += 1) {
      await recordAppInactivityWindow({ duration_minutes: 1 });
    }
    expect(await getAppInactivityWindows()).toHaveLength(60);
  });
});

describe("emergency alert settings", () => {
  it("devuelve defaults sin configuración", async () => {
    const settings = await getEmergencyAlertSettings();
    expect(settings.enabled).toBe(false);
    expect(settings.methods.notification).toBe(true);
    expect(settings.methods.whatsapp).toBe(false);
    expect(settings.contacts).toEqual([]);
  });

  it("mezcla parcialmente y conserva defaults", async () => {
    await saveEmergencyAlertSettings({
      enabled: true,
      methods: { whatsapp: true },
    });
    const settings = await getEmergencyAlertSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.methods.whatsapp).toBe(true);
    expect(settings.methods.notification).toBe(true);
    expect(settings.methods.email).toBe(false);
    expect(settings.contacts).toEqual([]);
  });

  it("guardar null conserva defaults", async () => {
    await saveEmergencyAlertSettings(null);
    const settings = await getEmergencyAlertSettings();
    expect(settings.enabled).toBe(false);
  });

  it("mantiene contactos solo si es array", async () => {
    await saveEmergencyAlertSettings({ contacts: [{ phone: "123" }] });
    expect((await getEmergencyAlertSettings()).contacts).toEqual([
      { phone: "123" },
    ]);
    await saveEmergencyAlertSettings({ contacts: "no-array" });
    expect((await getEmergencyAlertSettings()).contacts).toEqual([]);
  });
});

describe("JSON corrupto en SecureStore", () => {
  it("readJson devuelve fallback ante JSON inválido", async () => {
    store.set("asap.sleep.diary.entries", "{corrupto");
    expect(await listSleepDiaryEntries()).toEqual([]);
  });

  it("listSleepDiaryEntries con tipo inesperado devuelve []", async () => {
    store.set("asap.sleep.diary.entries", '{"no":"es array"}');
    expect(await listSleepDiaryEntries()).toEqual([]);
  });

  it("se escriben los valores JSON en SecureStore", async () => {
    await saveSleepDiaryEntry({ date: "2026-08-01", horas: 7 });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "asap.sleep.diary.entries",
      JSON.stringify([{ date: "2026-08-01", horas: 7 }]),
    );
  });
});

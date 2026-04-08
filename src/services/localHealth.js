import * as SecureStore from 'expo-secure-store';

const MONITOR_HINTS_KEY = 'asap.monitor.hints.hidden';
const SLEEP_DIARY_KEY = 'asap.sleep.diary.entries';
const PROFILE_SURVEY_KEY = 'asap.profile.survey';
const TIPS_PROGRESS_KEY = 'asap.tips.progress';
const OXIMETER_DEVICE_KEY = 'asap.oximeter.device';
const MONITOR_MODE_KEY = 'asap.monitor.mode';
const APP_INACTIVITY_WINDOWS_KEY = 'asap.app.inactivity.windows';
const EMERGENCY_ALERT_SETTINGS_KEY = 'asap.emergency.alert.settings';

async function readJson(key, fallback) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function getMonitorHintsHidden() {
  const value = await SecureStore.getItemAsync(MONITOR_HINTS_KEY);
  return value === '1';
}

export async function setMonitorHintsHidden(hidden) {
  await SecureStore.setItemAsync(MONITOR_HINTS_KEY, hidden ? '1' : '0');
}

export async function listSleepDiaryEntries() {
  const rows = await readJson(SLEEP_DIARY_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export async function saveSleepDiaryEntry(entry) {
  const rows = await listSleepDiaryEntries();
  const nextRows = [entry, ...rows.filter((row) => row?.date !== entry?.date)];
  const updated = nextRows.slice(0, 30);
  await writeJson(SLEEP_DIARY_KEY, updated);
  return updated;
}

export async function getProfileSurvey() {
  return readJson(PROFILE_SURVEY_KEY, null);
}

export async function saveProfileSurvey(payload) {
  const record = {
    ...payload,
    updated_at: new Date().toISOString(),
  };
  await writeJson(PROFILE_SURVEY_KEY, record);
  return record;
}

export async function getTipsProgress() {
  const value = await readJson(TIPS_PROGRESS_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

export async function saveTipsProgress(moduleId, checkedItems) {
  const progress = await getTipsProgress();
  const next = {
    ...progress,
    [moduleId]: {
      checked: Array.isArray(checkedItems) ? checkedItems : [],
      updated_at: new Date().toISOString(),
    },
  };
  await writeJson(TIPS_PROGRESS_KEY, next);
  return next[moduleId];
}

export async function getPreferredOximeterDevice() {
  return readJson(OXIMETER_DEVICE_KEY, null);
}

export async function savePreferredOximeterDevice(device) {
  await writeJson(OXIMETER_DEVICE_KEY, device || null);
  return device || null;
}

export async function clearPreferredOximeterDevice() {
  await writeJson(OXIMETER_DEVICE_KEY, null);
}

export async function getPreferredMonitorMode() {
  const mode = await SecureStore.getItemAsync(MONITOR_MODE_KEY);
  if (mode === 'cell_oximeter') {
    return 'cell_oximeter';
  }
  return 'cell_only';
}

export async function savePreferredMonitorMode(mode) {
  const normalized = mode === 'cell_oximeter' ? 'cell_oximeter' : 'cell_only';
  await SecureStore.setItemAsync(MONITOR_MODE_KEY, normalized);
  return normalized;
}

export async function recordAppInactivityWindow(windowPayload) {
  const rows = await readJson(APP_INACTIVITY_WINDOWS_KEY, []);
  const entry = {
    id: `${Date.now()}`,
    background_at: windowPayload?.background_at,
    foreground_at: windowPayload?.foreground_at,
    duration_minutes: windowPayload?.duration_minutes,
  };
  const updated = [entry, ...(Array.isArray(rows) ? rows : [])].slice(0, 60);
  await writeJson(APP_INACTIVITY_WINDOWS_KEY, updated);
  return updated;
}

export async function getAppInactivityWindows() {
  const rows = await readJson(APP_INACTIVITY_WINDOWS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

const DEFAULT_EMERGENCY_SETTINGS = {
  enabled: false,
  severe_threshold_events: 8,
  methods: {
    notification: true,
    whatsapp: false,
    sms: true,
    email: false,
    wake_alarm: true,
  },
  auto_dispatch: false,
  contacts: [],
};

export async function getEmergencyAlertSettings() {
  const settings = await readJson(EMERGENCY_ALERT_SETTINGS_KEY, DEFAULT_EMERGENCY_SETTINGS);
  return {
    ...DEFAULT_EMERGENCY_SETTINGS,
    ...(settings || {}),
    methods: {
      ...DEFAULT_EMERGENCY_SETTINGS.methods,
      ...((settings && settings.methods) || {}),
    },
    contacts: Array.isArray(settings?.contacts) ? settings.contacts : [],
  };
}

export async function saveEmergencyAlertSettings(settings) {
  const normalized = {
    ...DEFAULT_EMERGENCY_SETTINGS,
    ...(settings || {}),
    methods: {
      ...DEFAULT_EMERGENCY_SETTINGS.methods,
      ...((settings && settings.methods) || {}),
    },
    contacts: Array.isArray(settings?.contacts) ? settings.contacts : [],
    updated_at: new Date().toISOString(),
  };

  await writeJson(EMERGENCY_ALERT_SETTINGS_KEY, normalized);
  return normalized;
}

import Constants from 'expo-constants';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

let manager = null;
let connectedDevice = null;

const PULSE_OXIMETER_SERVICE_UUID = '00001810';
const SPO2_CONTINUOUS_UUID = '00002a5f';
const PULSE_RATE_UUID = '00002a54';
const SPO2_SPOT_UUID = '00002a5e';

let readingsSubscriptions = [];
let latestReading = { spo2: null, pulse: null, measuredAt: null };

function normUuid(uuid) {
  return String(uuid || '').toLowerCase().replace(/-/g, '');
}

function isPulseOximeterService(uuid) {
  const normalized = normUuid(uuid);
  return normalized === '1810' || normalized.endsWith('1810');
}

function isSpo2Characteristic(uuid) {
  const normalized = normUuid(uuid);
  return (
    normalized === SPO2_CONTINUOUS_UUID ||
    normalized === SPO2_SPOT_UUID ||
    normalized.endsWith('2a5f') ||
    normalized.endsWith('2a5e')
  );
}

function isPulseRateCharacteristic(uuid) {
  const normalized = normUuid(uuid);
  return normalized === PULSE_RATE_UUID || normalized.endsWith('2a54');
}

function decodeIeee11073Sfloat(byteOffset, bytes) {
  if (bytes.length < byteOffset + 2) {
    return null;
  }
  const raw = bytes[byteOffset] | (bytes[byteOffset + 1] << 8);
  const sign = raw & 0x8000 ? -1 : 1;
  const exponent = (raw >> 12) & 0x000f;
  const mantissa = raw & 0x0fff;

  if (mantissa === 0x0800 || mantissa === 0x0802) {
    return null; // NRes / -Inf
  }
  if (mantissa === 0x07fe || mantissa === 0x07ff) {
    return null; // +Inf / NaN
  }
  if (mantissa === 0x0801) {
    return null; // reserved
  }

  const exponentSigned = exponent >= 8 ? exponent - 16 : exponent;
  return sign * mantissa * Math.pow(10, exponentSigned);
}

function clampSpo2(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded >= 50 && rounded <= 100 ? rounded : null;
}

function clampPulse(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded >= 20 && rounded <= 240 ? rounded : null;
}

function handleSpo2MeasurementPacket(bytes) {
  const result = { spo2: null, pulse: null };
  if (!Array.isArray(bytes) || bytes.length < 1) {
    return result;
  }

  const flags = bytes[0];
  let offset = 1;

  if (flags & 0x01) {
    const value = decodeIeee11073Sfloat(offset, bytes);
    offset += 2;
    if (flags & 0x04) {
      offset += 4; // rango
    }
    result.spo2 = clampSpo2(value);
  }

  if (flags & 0x02) {
    const pulse = decodeIeee11073Sfloat(offset, bytes);
    offset += 2;
    if (flags & 0x08) {
      offset += 4; // rango
    }
    result.pulse = clampPulse(pulse);
  }

  if (result.spo2 === null && bytes.length >= 2) {
    result.spo2 = clampSpo2(bytes[1]);
    result.pulse = clampPulse(bytes[2]);
  }

  return result;
}

function handleRawBytes(bytes) {
  const result = { spo2: null, pulse: null };

  if (!Array.isArray(bytes) || bytes.length === 0) {
    return result;
  }

  if (bytes.length >= 2 && bytes[0] >= 50 && bytes[0] <= 100) {
    result.spo2 = clampSpo2(bytes[0]);
    if (bytes.length >= 3) {
      result.pulse = clampPulse(bytes[1]);
    }
  }

  return result;
}

function updateReading(reading, onReading) {
  if (reading.spo2 === null && reading.pulse === null) {
    return;
  }

  const next = {
    spo2: reading.spo2 !== null ? reading.spo2 : latestReading.spo2,
    pulse: reading.pulse !== null ? reading.pulse : latestReading.pulse,
    measuredAt: Date.now(),
  };
  latestReading = next;

  if (typeof onReading === 'function') {
    onReading(next);
  }
}

async function subscribeCharacteristic(device, serviceUuid, charUuid, onReading) {
  const emitter = device.monitorCharacteristicForService(
    serviceUuid,
    charUuid,
    (error, characteristic) => {
      if (error || !characteristic?.value) {
        return;
      }

      const bytes = Array.from(characteristic.value);
      if (isSpo2Characteristic(charUuid)) {
        updateReading(handleSpo2MeasurementPacket(bytes), onReading);
        return;
      }
      if (isPulseRateCharacteristic(charUuid)) {
        updateReading({ spo2: null, pulse: clampPulse(bytes[0]) }, onReading);
        return;
      }
      updateReading(handleRawBytes(bytes), onReading);
    },
  );

  readingsSubscriptions.push(emitter);
}

function isNotifiable(characteristic) {
  const props = characteristic?.properties || {};
  return Boolean(props.notify || props.indicate);
}

export async function startOximeterReading(onReading) {
  if (!connectedDevice?.id) {
    throw new Error('No hay oxímetro conectado.');
  }

  await stopOximeterReading();

  const bleManager = await getManager();
  const devices = await bleManager.devices([connectedDevice.id]);
  const device = devices?.[0];
  if (!device) {
    throw new Error('No se pudo recuperar el oxímetro conectado.');
  }

  await device.connect({ timeout: 8000 }).catch(() => null);
  await device.discoverAllServicesAndCharacteristics();

  const services = await device.services();
  const pulseOx = services.find((s) => isPulseOximeterService(s.uuid));

  if (pulseOx) {
    const chars = await device.characteristicsForService(pulseOx.uuid);
    for (const char of chars) {
      if (!isNotifiable(char)) {
        continue;
      }
      if (isSpo2Characteristic(char.uuid) || isPulseRateCharacteristic(char.uuid)) {
        await subscribeCharacteristic(device, pulseOx.uuid, char.uuid, onReading);
      }
    }
  }

  if (readingsSubscriptions.length === 0) {
    for (const service of services) {
      const chars = await device.characteristicsForService(service.uuid);
      for (const char of chars) {
        if (!isNotifiable(char)) {
          continue;
        }
        await subscribeCharacteristic(device, service.uuid, char.uuid, onReading);
      }
    }
  }

  if (readingsSubscriptions.length === 0) {
    throw new Error('El oxímetro no expone datos de SpO2. Revisa que esté encendido y en el dedo.');
  }
}

export async function stopOximeterReading() {
  for (const subscription of readingsSubscriptions) {
    try {
      subscription.remove();
    } catch {
      // Sin bloqueo
    }
  }
  readingsSubscriptions = [];
  latestReading = { spo2: null, pulse: null, measuredAt: null };
}

export function getLatestOximeterReading() {
  return latestReading;
}

function isExpoGoEnvironment() {
  return Constants?.appOwnership === 'expo' || Constants?.executionEnvironment === 'storeClient';
}

async function getManager() {
  if (manager) {
    return manager;
  }

  if (Platform.OS === 'web') {
    throw new Error('Bluetooth no está disponible en la versión web. Usa Android o iPhone con una compilación nativa.');
  }

  if (isExpoGoEnvironment()) {
    throw new Error('Bluetooth BLE no funciona en Expo Go. Necesitas una Development Build para conectar el oxímetro.');
  }

  let moduleRef;
  try {
    moduleRef = await import('react-native-ble-plx');
  } catch {
    throw new Error('Bluetooth no disponible en este build. Usa Development Build para conectar oxímetro.');
  }

  const BleManagerClass = moduleRef?.BleManager || moduleRef?.default?.BleManager || moduleRef?.default;
  if (!BleManagerClass) {
    throw new Error('No fue posible inicializar Bluetooth en este dispositivo.');
  }

  try {
    manager = new BleManagerClass();
    return manager;
  } catch (error) {
    manager = null;

    if (String(error?.message || '').toLowerCase().includes('createclient')) {
      throw new Error('El módulo nativo de Bluetooth no está cargado. Usa una Development Build, no Expo Go.');
    }

    throw error;
  }
}

async function requestAndroidBlePermissions() {
  if (Platform.OS !== 'android') {
    return true;
  }

  const sdk = Number(Platform.Version || 0);
  const permissions = sdk >= 31
    ? [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export async function isBluetoothEnabled() {
  try {
    const bleManager = await getManager();
    const state = await bleManager.state();
    // States: PoweredOff, PoweredOn, Resetting, Unauthorized, Unknown
    return state === 'PoweredOn';
  } catch {
    return false;
  }
}

export async function requestEnableBluetooth() {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    const enabled = await isBluetoothEnabled();
    if (!enabled) {
      Alert.alert(
        'Bluetooth desactivado',
        'El Bluetooth debe estar activado para conectar el oxímetro. Por favor, actívalo en Configuración.',
      );
    }
  } catch {
    // Silencioso - continúa de todas formas
  }
}

function isLikelyOximeter(device) {
  const name = `${device?.name || ''} ${device?.localName || ''}`.toLowerCase();
  return name.includes('oxi') || name.includes('spo2') || name.includes('pulse') || name.includes('saturation');
}

export async function scanOximeters(timeoutMs = 6000) {
  const bleManager = await getManager();
  const granted = await requestAndroidBlePermissions();
  if (!granted) {
    throw new Error('Permisos de Bluetooth no otorgados.');
  }

  if (isExpoGoEnvironment()) {
    throw new Error('Bluetooth BLE no funciona en Expo Go. Usa una Development Build para conectar el oxímetro.');
  }

  const devicesById = new Map();

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      bleManager.stopDeviceScan();
      resolve();
    }, timeoutMs);

    bleManager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        clearTimeout(timeout);
        bleManager.stopDeviceScan();
        reject(new Error(error.message || 'No se pudo escanear dispositivos Bluetooth.'));
        return;
      }

      if (!device?.id) {
        return;
      }

      if (!device.name && !device.localName) {
        return;
      }

      if (!isLikelyOximeter(device)) {
        return;
      }

      devicesById.set(device.id, {
        id: device.id,
        name: device.name || device.localName || 'Oxímetro sin nombre',
        rssi: device.rssi,
      });
    });
  });

  return Array.from(devicesById.values()).sort((a, b) => (b.rssi || -999) - (a.rssi || -999));
}

export async function connectToOximeter(deviceId) {
  if (!deviceId) {
    throw new Error('Selecciona un oxímetro para conectar.');
  }

  const bleManager = await getManager();
  const granted = await requestAndroidBlePermissions();
  if (!granted) {
    throw new Error('Permisos de Bluetooth no otorgados.');
  }

  if (isExpoGoEnvironment()) {
    throw new Error('Bluetooth BLE no funciona en Expo Go. Usa una Development Build para conectar el oxímetro.');
  }

  const device = await bleManager.connectToDevice(deviceId, { autoConnect: false, timeout: 12000 });
  await device.discoverAllServicesAndCharacteristics();

  connectedDevice = {
    id: device.id,
    name: device.name || device.localName || 'Oxímetro conectado',
  };

  return connectedDevice;
}

export async function disconnectOximeter() {
  if (!connectedDevice?.id) {
    return;
  }

  const bleManager = await getManager();
  try {
    await bleManager.cancelDeviceConnection(connectedDevice.id);
  } catch {
    // Silencioso para evitar romper flujo de UI.
  } finally {
    connectedDevice = null;
  }
}

export function getConnectedOximeter() {
  return connectedDevice;
}

export async function isOximeterConnected(deviceId) {
  if (!deviceId) {
    return false;
  }

  const bleManager = await getManager();
  try {
    return await bleManager.isDeviceConnected(deviceId);
  } catch {
    return false;
  }
}

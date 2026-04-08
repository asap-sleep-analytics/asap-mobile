import Constants from 'expo-constants';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

let manager = null;
let connectedDevice = null;

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

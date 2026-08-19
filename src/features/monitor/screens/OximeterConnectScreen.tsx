import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AmbientBackdrop from '../../../components/AmbientBackdrop';
import GlassCard from '../../../components/GlassCard';
import {
  connectToOximeter,
  disconnectOximeter,
  getConnectedOximeter,
  isOximeterConnected,
  requestEnableBluetooth,
  scanOximeters,
} from '../../../services/oximeterBluetooth';
import {
  clearPreferredOximeterDevice,
  getPreferredOximeterDevice,
  savePreferredOximeterDevice,
} from '../../../services/localHealth';
import type { ConnectedOximeter, OximeterDevice } from '../../../types';
import { fonts, palette } from '../../../theme/tokens';

export default function OximeterConnectScreen() {
  const [devices, setDevices] = useState<OximeterDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState('');
  const [connectedDevice, setConnectedDevice] = useState<ConnectedOximeter | null>(null);
  const [error, setError] = useState('');

  const loadConnectionStatus = useCallback(async () => {
    const preferred = await getPreferredOximeterDevice();
    if (!preferred?.id) {
      setConnectedDevice(getConnectedOximeter() || null);
      return;
    }

    const active = await isOximeterConnected(preferred.id);
    if (active) {
      setConnectedDevice(preferred);
      return;
    }

    const live = getConnectedOximeter();
    setConnectedDevice(live || null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConnectionStatus();
    }, [loadConnectionStatus]),
  );

  const handleScan = async () => {
    setLoading(true);
    setError('');
    setDevices([]);

    try {
      // Check and request Bluetooth to be enabled if needed
      await requestEnableBluetooth();

      const scanned = await scanOximeters(6500);
      setDevices(scanned);
      if (scanned.length === 0) {
        setError('No encontramos oxímetros cerca. Activa Bluetooth y acerca el dispositivo.');
      }
    } catch (err) {
      setError((err as Error)?.message || 'No fue posible escanear dispositivos Bluetooth.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (device: OximeterDevice) => {
    setConnectingId(device.id);
    setError('');

    try {
      const connected = await connectToOximeter(device.id);
      await savePreferredOximeterDevice(connected);
      setConnectedDevice(connected);
      Alert.alert('Conectado', `Oxímetro conectado: ${connected.name}`);
    } catch (err) {
      setError((err as Error)?.message || 'No se pudo conectar el oxímetro.');
    } finally {
      setConnectingId('');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectOximeter();
      await clearPreferredOximeterDevice();
      setConnectedDevice(null);
    } catch (err) {
      setError((err as Error)?.message || 'No fue posible desconectar el oxímetro.');
    }
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Bluetooth</Text>
        <Text style={styles.title}>Conectar oxímetro</Text>
        <Text style={styles.subtitle}>Vincula tu oxímetro para usar monitoreo Celular + Oxímetro.</Text>

        <GlassCard style={styles.stateCard}>
          <Text style={styles.stateLabel}>Estado actual</Text>
          <Text style={styles.stateValue}>{connectedDevice ? 'Conectado' : 'Sin conexión'}</Text>
          <Text style={styles.stateHint}>{connectedDevice ? connectedDevice.name : 'Ningún oxímetro enlazado'}</Text>

          <View style={styles.rowActions}>
            <Pressable onPress={handleScan} style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]}>
              <Text style={styles.primaryButtonText}>{loading ? 'Buscando...' : 'Buscar dispositivos'}</Text>
            </Pressable>
            <Pressable onPress={handleDisconnect} style={({ pressed }) => [styles.ghostButton, pressed ? styles.pressed : null]}>
              <Text style={styles.ghostButtonText}>Desconectar</Text>
            </Pressable>
          </View>

          {loading ? <ActivityIndicator color={palette.primary} style={styles.loader} /> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </GlassCard>

        {devices.map((device) => {
          const connecting = connectingId === device.id;
          const active = connectedDevice?.id === device.id;

          return (
            <GlassCard key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceHead}>
                <View>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceMeta}>Señal: {typeof device.rssi === 'number' ? `${device.rssi} dBm` : '--'}</Text>
                </View>
                <Text style={styles.deviceMeta}>{active ? 'Conectado' : 'Disponible'}</Text>
              </View>

              <Pressable
                onPress={() => handleConnect(device)}
                disabled={connecting || active}
                style={({ pressed }) => [styles.connectButton, pressed ? styles.pressed : null, (connecting || active) ? styles.disabled : null]}
              >
                <Text style={styles.connectButtonText}>{active ? 'Listo' : connecting ? 'Conectando...' : 'Conectar'}</Text>
              </Pressable>
            </GlassCard>
          );
        })}
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.35)',
    backgroundColor: palette.primarySoft,
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  title: {
    marginTop: 8,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  stateCard: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  stateLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stateValue: {
    marginTop: 6,
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 28,
  },
  stateHint: {
    marginTop: 4,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  rowActions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
  },
  ghostButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    alignItems: 'center',
    paddingVertical: 11,
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  loader: {
    marginTop: 10,
  },
  errorText: {
    marginTop: 10,
    color: palette.danger,
    fontFamily: fonts.body,
  },
  deviceCard: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
  },
  deviceHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  deviceMeta: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  connectButton: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.5)',
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    paddingVertical: 9,
  },
  connectButtonText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
});

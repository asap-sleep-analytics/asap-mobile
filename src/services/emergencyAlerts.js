import Constants from 'expo-constants';
import { Alert, Linking, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function buildEmergencyMessage(payload) {
  const modeLabel = payload?.monitoringMode === 'cell_oximeter' ? 'Celular + oxímetro' : 'Solo celular';
  return `ALERTA A.S.A.P.: posible apnea severa detectada. Sesión ${payload?.sessionId || '--'}. Eventos estimados: ${payload?.estimatedEvents || '--'}. Modo: ${modeLabel}. Hora: ${new Date().toLocaleString('es-CO')}.`;
}

function isExpoGoEnvironment() {
  return Constants?.appOwnership === 'expo' || Constants?.executionEnvironment === 'storeClient';
}

async function sendLocalNotification(message) {
  if (isExpoGoEnvironment()) {
    return false;
  }

  const permissions = await Notifications.requestPermissionsAsync();
  if (permissions.status !== 'granted') {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Alerta de apnea severa',
      body: message,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null,
  });

  return true;
}

async function dispatchLinks(settings, message) {
  const contacts = Array.isArray(settings?.contacts) ? settings.contacts : [];
  if (contacts.length === 0) {
    return;
  }

  const first = contacts[0];
  const phone = normalizePhone(first?.phone);
  const email = String(first?.email || '').trim();

  if (settings?.methods?.whatsapp && phone) {
    const url = `whatsapp://send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  }

  if (settings?.methods?.sms && phone) {
    await Linking.openURL(`sms:${phone}?body=${encodeURIComponent(message)}`);
    return;
  }

  if (settings?.methods?.email && email) {
    await Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Alerta A.S.A.P.')}&&body=${encodeURIComponent(message)}`);
  }
}

export async function triggerSevereApneaAlert(settings, payload) {
  if (!settings?.enabled) {
    return { triggered: false, reason: 'disabled' };
  }

  const message = buildEmergencyMessage(payload);

  if (settings?.methods?.wake_alarm) {
    Vibration.vibrate([0, 800, 300, 900, 300, 1000]);
  }

  if (settings?.methods?.notification) {
    const sent = await sendLocalNotification(message);
    if (!sent && isExpoGoEnvironment()) {
      Alert.alert(
        'Notificaciones limitadas',
        'Expo Go no permite probar notificaciones de emergencia completas. Usa una Development Build para verificar esta función.',
      );
    }
  }

  if (settings?.auto_dispatch) {
    await dispatchLinks(settings, message);
  } else {
    Alert.alert('Alerta de apnea severa', message, [
      {
        text: 'Enviar alerta',
        onPress: () => {
          dispatchLinks(settings, message).catch(() => null);
        },
      },
      { text: 'Cerrar', style: 'cancel' },
    ]);
  }

  return { triggered: true };
}

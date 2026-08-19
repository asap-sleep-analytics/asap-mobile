import 'react-native-gesture-handler';
import React, { useContext, useEffect, useRef } from 'react';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, useFonts as useManropeFonts } from '@expo-google-fonts/manrope';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts as useSpaceGroteskFonts,
} from '@expo-google-fonts/space-grotesk';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppState } from 'react-native';

import { AppContext, AppProvider } from './src/context/AppContext';
import AuthScreen from './src/features/auth/screens/AuthScreen';
import DashboardHomeScreen from './src/features/dashboard/screens/DashboardHomeScreen';
import HistorySessionsScreen from './src/features/history/screens/HistorySessionsScreen';
import MonitorActiveScreen from './src/features/monitor/screens/MonitorActiveScreen';
import MonitorControlScreen from './src/features/monitor/screens/MonitorControlScreen';
import MonitorSummaryScreen from './src/features/monitor/screens/MonitorSummaryScreen';
import OximeterConnectScreen from './src/features/monitor/screens/OximeterConnectScreen';
import SleepDiaryScreen from './src/features/monitor/screens/SleepDiaryScreen';
import EmergencyAlertsScreen from './src/features/profile/screens/EmergencyAlertsScreen';
import ProfileHomeScreen from './src/features/profile/screens/ProfileHomeScreen';
import TipsDetailScreen from './src/features/tips/screens/TipsDetailScreen';
import TipsHomeScreen from './src/features/tips/screens/TipsHomeScreen';
import { recordAppInactivityWindow } from './src/services/localHealth';
import { fonts, palette } from './src/theme/tokens';

const AuthStack = createStackNavigator();
const DashboardStack = createStackNavigator();
const MonitorStack = createStackNavigator();
const HistoryStack = createStackNavigator();
const ProfileStack = createStackNavigator();
const TipsStack = createStackNavigator();
const Tab = createBottomTabNavigator();

const sharedStackOptions = {
  headerStyle: {
    backgroundColor: palette.background,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTintColor: palette.textPrimary,
  headerTitleStyle: {
    fontFamily: fonts.headingMedium,
    letterSpacing: 0.6,
    color: palette.textPrimary,
  },
  cardStyle: {
    backgroundColor: palette.background,
  },
};

function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="AuthScreen" component={AuthScreen} />
    </AuthStack.Navigator>
  );
}

function DashboardStackNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={sharedStackOptions}>
      <DashboardStack.Screen
        name="DashboardHome"
        component={DashboardHomeScreen}
        options={{ title: 'Resumen de riesgo' }}
      />
    </DashboardStack.Navigator>
  );
}

function MonitorStackNavigator() {
  return (
    <MonitorStack.Navigator screenOptions={sharedStackOptions}>
      <MonitorStack.Screen
        name="MonitorCenter"
        component={MonitorControlScreen}
        options={{ title: 'Monitoreo nocturno' }}
      />
      <MonitorStack.Screen
        name="MonitorActive"
        component={MonitorActiveScreen}
        options={{ headerShown: false }}
      />
      <MonitorStack.Screen
        name="MonitorSummary"
        component={MonitorSummaryScreen}
        options={{ title: 'Resultado de la noche' }}
      />
      <MonitorStack.Screen
        name="SleepDiary"
        component={SleepDiaryScreen}
        options={{ title: 'Registro de sueño' }}
      />
      <MonitorStack.Screen
        name="OximeterConnect"
        component={OximeterConnectScreen}
        options={{ title: 'Oxímetro Bluetooth' }}
      />
    </MonitorStack.Navigator>
  );
}

function HistoryStackNavigator() {
  return (
    <HistoryStack.Navigator screenOptions={sharedStackOptions}>
      <HistoryStack.Screen
        name="HistoryHome"
        component={HistorySessionsScreen}
        options={{ title: 'Historial de apneas' }}
      />
    </HistoryStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={sharedStackOptions}>
      <ProfileStack.Screen
        name="ProfileHome"
        component={ProfileHomeScreen}
        options={{ title: 'Perfil' }}
      />
      <ProfileStack.Screen
        name="EmergencyAlerts"
        component={EmergencyAlertsScreen}
        options={{ title: 'Alertas de emergencia' }}
      />
    </ProfileStack.Navigator>
  );
}

function TipsStackNavigator() {
  return (
    <TipsStack.Navigator screenOptions={sharedStackOptions}>
      <TipsStack.Screen
        name="TipsHome"
        component={TipsHomeScreen}
        options={{ title: 'Prevención' }}
      />
      <TipsStack.Screen
        name="TipsDetail"
        component={TipsDetailScreen}
        options={{ title: 'Detalle del módulo' }}
      />
    </TipsStack.Navigator>
  );
}

function AppTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const focusedIcons = {
          DashboardTab: 'pulse',
          MonitorTab: 'moon',
          HistoryTab: 'time',
          TipsTab: 'book',
          ProfileTab: 'person',
        };

        const outlineIcons = {
          DashboardTab: 'pulse-outline',
          MonitorTab: 'moon-outline',
          HistoryTab: 'time-outline',
          TipsTab: 'book-outline',
          ProfileTab: 'person-outline',
        };

        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.textMuted,
          tabBarLabelStyle: {
            fontFamily: fonts.bodyBold,
            fontSize: 11,
          },
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopWidth: 1,
            borderTopColor: palette.borderSoft,
            height: 66,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarIcon: ({ focused, color, size }) => {
            const dynamicIconName = focused
              ? focusedIcons[route.name] || 'ellipse'
              : outlineIcons[route.name] || 'ellipse-outline';

            return <Ionicons name={dynamicIconName} color={color} size={Math.max(size, 21)} />;
          },
        };
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStackNavigator}
        options={{ title: 'Riesgo' }}
      />
      <Tab.Screen
        name="MonitorTab"
        component={MonitorStackNavigator}
        options={{ title: 'Monitorear' }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{ title: 'Historial' }}
      />
      <Tab.Screen
        name="TipsTab"
        component={TipsStackNavigator}
        options={{ title: 'Prevenir' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}

function AppNavigationGate() {
  const { authLoading, isAuthenticated } = useContext(AppContext);

  if (authLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={styles.loaderText}>Restaurando tu sesión segura...</Text>
      </View>
    );
  }

  return <NavigationContainer>{isAuthenticated ? <AppTabsNavigator /> : <AuthStackNavigator />}</NavigationContainer>;
}

export default function App() {
  const appStateRef = useRef(AppState.currentState);
  const backgroundAtRef = useRef(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;

      if (prevState === 'active' && (nextState === 'background' || nextState === 'inactive')) {
        backgroundAtRef.current = Date.now();
      }

      if ((prevState === 'background' || prevState === 'inactive') && nextState === 'active' && backgroundAtRef.current) {
        const foregroundAt = Date.now();
        const durationMinutes = Math.round((foregroundAt - backgroundAtRef.current) / 60000);

        if (durationMinutes >= 15) {
          recordAppInactivityWindow({
            background_at: new Date(backgroundAtRef.current).toISOString(),
            foreground_at: new Date(foregroundAt).toISOString(),
            duration_minutes: durationMinutes,
          }).catch(() => null);
        }

        backgroundAtRef.current = null;
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const [manropeReady] = useManropeFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });

  const [spaceReady] = useSpaceGroteskFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  if (!manropeReady || !spaceReady) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={styles.loaderText}>Cargando experiencia A.S.A.P.</Text>
      </View>
    );
  }

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <AppNavigationGate />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  loaderText: {
    marginTop: 12,
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
});
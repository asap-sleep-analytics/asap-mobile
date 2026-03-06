import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { AppProvider } from './src/context/AppContext';
import AnalyzeScreen from './src/screens/AnalyzeScreen';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: { backgroundColor: '#0B2545' },
            headerTintColor: '#FFFFFF',
            contentStyle: { backgroundColor: '#F4F7FB' },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'A.S.A.P. Mobile' }}
          />
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ title: 'Acceso' }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'Dashboard' }}
          />
          <Stack.Screen
            name="Analyze"
            component={AnalyzeScreen}
            options={{ title: 'Analyze Metadata' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}

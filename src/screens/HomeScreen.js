import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Apnea Sleep Analytics Platform</Text>
      <Text style={styles.subtitle}>
        App React Native para registro, monitoreo nocturno y resumen de riesgo en tiempo real.
      </Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate('Auth')}>
        <Text style={styles.buttonText}>Entrar / Registrarme</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => navigation.navigate('Analyze')}>
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Analisis de metadata</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#F4F7FB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B2545',
  },
  subtitle: {
    marginTop: 12,
    marginBottom: 30,
    fontSize: 16,
    color: '#2E3A4C',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#0B2545',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0B2545',
  },
  secondaryButtonText: {
    color: '#0B2545',
  },
});

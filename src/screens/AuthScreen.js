import React, { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppContext } from '../context/AppContext';
import { getApiErrorMessage, loginUser, registerUser } from '../services/api';

export default function AuthScreen({ navigation }) {
  const { signIn } = useContext(AppContext);
  const [mode, setMode] = useState('login');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roncaHabitualmente, setRoncaHabitualmente] = useState(false);
  const [cansancioDiurno, setCansancioDiurno] = useState(false);
  const [aceptaConsentimientoDatos, setAceptaConsentimientoDatos] = useState(false);
  const [aceptaDisclaimerMedico, setAceptaDisclaimerMedico] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegisterMode = mode === 'register';

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const payload = isRegisterMode
        ? {
            nombre_completo: nombreCompleto,
            email,
            password,
            ronca_habitualmente: roncaHabitualmente,
            cansancio_diurno: cansancioDiurno,
            acepta_consentimiento_datos: aceptaConsentimientoDatos,
            acepta_disclaimer_medico: aceptaDisclaimerMedico,
          }
        : {
            email,
            password,
          };

      const response = isRegisterMode ? await registerUser(payload) : await loginUser(payload);

      signIn(response.access_token, response.usuario);
      navigation.replace('Dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'No fue posible autenticar al usuario.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Acceso Seguro</Text>
      <Text style={styles.subtitle}>
        {isRegisterMode
          ? 'Registra tu cuenta para activar monitoreo y dashboard.'
          : 'Inicia sesion para ver tu resumen de sueno.'}
      </Text>

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeButton, mode === 'login' ? styles.modeButtonActive : null]}
          onPress={() => setMode('login')}
        >
          <Text style={[styles.modeButtonText, mode === 'login' ? styles.modeButtonTextActive : null]}>
            Login
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'register' ? styles.modeButtonActive : null]}
          onPress={() => setMode('register')}
        >
          <Text style={[styles.modeButtonText, mode === 'register' ? styles.modeButtonTextActive : null]}>
            Registro
          </Text>
        </Pressable>
      </View>

      {isRegisterMode ? (
        <>
          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            value={nombreCompleto}
            onChangeText={setNombreCompleto}
            style={styles.input}
            autoCapitalize="words"
          />
        </>
      ) : null}

      <Text style={styles.label}>Correo</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Contrasena</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
      />

      {isRegisterMode ? (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Roncas habitualmente</Text>
            <Switch value={roncaHabitualmente} onValueChange={setRoncaHabitualmente} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Sientes cansancio diurno</Text>
            <Switch value={cansancioDiurno} onValueChange={setCansancioDiurno} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Acepto tratamiento de datos (Ley 1581)</Text>
            <Switch value={aceptaConsentimientoDatos} onValueChange={setAceptaConsentimientoDatos} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Acepto que no reemplaza diagnostico medico</Text>
            <Switch value={aceptaDisclaimerMedico} onValueChange={setAceptaDisclaimerMedico} />
          </View>
        </>
      ) : null}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>{isRegisterMode ? 'Crear cuenta' : 'Entrar'}</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F4F7FB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0B2545',
  },
  subtitle: {
    marginTop: 8,
    color: '#334155',
    lineHeight: 20,
  },
  modeRow: {
    marginTop: 18,
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 4,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 8,
  },
  modeButtonActive: {
    backgroundColor: '#0B2545',
  },
  modeButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    fontWeight: '600',
    color: '#334155',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  switchRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    color: '#334155',
    lineHeight: 20,
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: '#0B2545',
    alignItems: 'center',
    paddingVertical: 12,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 12,
    color: '#B91C1C',
  },
});

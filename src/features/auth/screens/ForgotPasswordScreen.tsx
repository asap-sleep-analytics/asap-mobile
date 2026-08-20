import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import GlassCard from "../../../components/GlassCard";
import { forgotPassword, getApiErrorMessage } from "../../../services/api";
import { fonts, palette } from "../../../theme/tokens";

type AuthStackParamList = { AuthScreen: undefined };

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    Keyboard.dismiss();
    setError("");
    setLoading(true);

    try {
      const response = await forgotPassword(email);
      if (response?.mensaje) {
        setError(response.mensaje);
      }
      setSent(true);
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          "No fue posible enviar el enlace de recuperación.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AmbientBackdrop>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <GlassCard style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={26} color={palette.primary} />
            </View>
            <Text style={styles.title}>Recupera tu contraseña</Text>
            <Text style={styles.subtitle}>
              Escribe el correo de tu cuenta y te enviaremos un enlace para
              restablecerla.
            </Text>

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="nombre@correo.com"
              placeholderTextColor={palette.textMuted}
              editable={!loading}
            />

            {error ? (
              <Text
                style={[
                  styles.helperText,
                  sent ? styles.infoText : styles.errorText,
                ]}
              >
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.submitButton,
                loading || !email.trim() ? styles.disabledButton : null,
              ]}
              onPress={handleSend}
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Enviar enlace</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.backLink}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={16} color={palette.primary} />
              <Text style={styles.backLinkText}>
                Volver al inicio de sesión
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </KeyboardAvoidingView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.headingMedium,
    fontSize: 22,
    color: palette.textPrimary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: palette.textMuted,
    textAlign: "center",
    marginBottom: 22,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.bodyRegular,
    color: palette.textPrimary,
    marginBottom: 12,
  },
  helperText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    color: palette.danger,
  },
  infoText: {
    color: palette.success,
  },
  submitButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  backLinkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.primary,
  },
});

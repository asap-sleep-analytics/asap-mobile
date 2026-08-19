import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import GlassCard from "../../../components/GlassCard";
import { AppContext } from "../../../context/AppContext";
import {
  getApiErrorMessage,
  loginUser,
  registerUser,
  socialLoginUser,
} from "../../../services/api";
import { fonts, palette } from "../../../theme/tokens";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";

type AuthMode = "login" | "register";
type AuthStackParamList = {
  AuthScreen: undefined;
  Terms: undefined;
  ForgotPassword: undefined;
};

export default function AuthScreen() {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const { signIn } = useContext(AppContext) as {
    signIn: (
      token: string,
      userPayload: unknown,
      expiresInSeconds?: number,
    ) => Promise<void>;
  };
  const [mode, setMode] = useState<AuthMode>("login");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [roncaHabitualmente, setRoncaHabitualmente] = useState(false);
  const [cansancioDiurno, setCansancioDiurno] = useState(false);
  const [aceptaTerminosCondiciones, setAceptaTerminosCondiciones] =
    useState(false);
  const [aceptaConsentimientoDatos, setAceptaConsentimientoDatos] =
    useState(false);
  const [aceptaDisclaimerMedico, setAceptaDisclaimerMedico] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(
    null,
  );
  const [error, setError] = useState("");

  const [googleRequest, , googlePromptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
  });

  const isRegisterMode = mode === "register";
  const legalPending =
    isRegisterMode &&
    (!aceptaTerminosCondiciones ||
      !aceptaConsentimientoDatos ||
      !aceptaDisclaimerMedico);
  const socialLegalPayload = {
    acepta_terminos_condiciones: aceptaTerminosCondiciones,
    acepta_consentimiento_datos: aceptaConsentimientoDatos,
    acepta_disclaimer_medico: aceptaDisclaimerMedico,
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const payload = isRegisterMode
        ? {
            nombre_completo: nombreCompleto,
            email,
            password,
            ronca_habitualmente: roncaHabitualmente,
            cansancio_diurno: cansancioDiurno,
            acepta_terminos_condiciones: aceptaTerminosCondiciones,
            acepta_consentimiento_datos: aceptaConsentimientoDatos,
            acepta_disclaimer_medico: aceptaDisclaimerMedico,
          }
        : {
            email,
            password,
          };

      const response = isRegisterMode
        ? await registerUser(payload)
        : await loginUser(payload);

      await signIn(
        response.access_token,
        response.usuario,
        response.expires_in,
      );
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, "No fue posible autenticar al usuario."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "apple") => {
    setSocialLoading(provider);
    setError("");

    if (isRegisterMode && legalPending) {
      setError("Acepta los tres consentimientos para poder continuar.");
      setSocialLoading(null);
      return;
    }

    try {
      let idToken = "";

      if (provider === "google") {
        if (!googleRequest) {
          setError(
            "Faltan los clientes de Google. Configura EXPO_PUBLIC_GOOGLE_* en tu .env.",
          );
          return;
        }
        const result = await googlePromptAsync();
        if (result?.type !== "success") {
          if (result?.type === "error" && result.error) {
            setError(
              result.error.message || "Google no completó el inicio de sesión.",
            );
          }
          return;
        }
        idToken = result.authentication?.idToken || "";
        if (!idToken) {
          setError("Google no devolvió un token válido.");
          return;
        }
      } else {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          ],
        });
        idToken = credential.identityToken || "";
        if (!idToken) {
          setError("Apple no devolvió un token válido.");
          return;
        }
      }

      const response = await socialLoginUser({
        provider,
        id_token: idToken,
        nombre_completo:
          isRegisterMode && nombreCompleto.trim()
            ? nombreCompleto.trim()
            : undefined,
        ronca_habitualmente: roncaHabitualmente,
        cansancio_diurno: cansancioDiurno,
        ...socialLegalPayload,
      });

      await signIn(
        response.access_token,
        response.usuario,
        response.expires_in,
      );
    } catch (err: unknown) {
      const message = getApiErrorMessage(
        err,
        "No fue posible iniciar sesión con el proveedor.",
      );
      if (message.includes("aceptar")) {
        setMode("register");
      }
      setError(message);
    } finally {
      setSocialLoading(null);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
  };

  return (
    <AmbientBackdrop>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.badge}>Acceso</Text>
        <Text style={styles.title}>A.S.A.P. Detección de apnea</Text>
        <Text style={styles.subtitle}>
          {isRegisterMode
            ? "Crea tu cuenta para comenzar a monitorear tu respiración durante el sueño."
            : "Inicia sesión para ver tu riesgo de apnea y tus monitoreos nocturnos."}
        </Text>

        <GlassCard>
          <View style={styles.modeRow}>
            <Pressable
              style={[
                styles.modeButton,
                mode === "login" ? styles.modeButtonActive : null,
              ]}
              onPress={() => switchMode("login")}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "login" ? styles.modeButtonTextActive : null,
                ]}
              >
                Iniciar sesión
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeButton,
                mode === "register" ? styles.modeButtonActive : null,
              ]}
              onPress={() => switchMode("register")}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === "register" ? styles.modeButtonTextActive : null,
                ]}
              >
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
                autoComplete="name"
                textContentType="name"
                placeholder="Tu nombre"
                placeholderTextColor={palette.textMuted}
              />
            </>
          ) : null}

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
          />

          <Text style={styles.label}>Contraseña</Text>
          <View style={styles.passwordField}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.passwordInput}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoComplete={
                isRegisterMode ? "new-password" : "current-password"
              }
              textContentType={isRegisterMode ? "newPassword" : "password"}
              placeholder="Tu contraseña"
              placeholderTextColor={palette.textMuted}
            />
            <Pressable
              onPress={() => setPasswordVisible((visible) => !visible)}
              style={styles.eyeButton}
              hitSlop={10}
              accessibilityLabel={
                passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"
              }
            >
              <Ionicons
                name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={palette.textMuted}
              />
            </Pressable>
          </View>

          {isRegisterMode ? (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Roncas habitualmente</Text>
                <Switch
                  value={roncaHabitualmente}
                  onValueChange={setRoncaHabitualmente}
                  trackColor={{
                    false: palette.borderSoft,
                    true: palette.primarySoft,
                  }}
                  thumbColor={roncaHabitualmente ? palette.primary : "#f4f4f5"}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Sientes cansancio diurno</Text>
                <Switch
                  value={cansancioDiurno}
                  onValueChange={setCansancioDiurno}
                  trackColor={{
                    false: palette.borderSoft,
                    true: palette.primarySoft,
                  }}
                  thumbColor={cansancioDiurno ? palette.primary : "#f4f4f5"}
                />
              </View>

              <View style={styles.switchRow}>
                <Pressable
                  style={styles.legalSwitchLabel}
                  onPress={() => navigation.navigate("Terms")}
                >
                  <Text style={styles.switchLabel}>
                    Acepto los{" "}
                    <Text style={styles.legalLink}>términos y condiciones</Text>
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={palette.textMuted}
                  />
                </Pressable>
                <Switch
                  value={aceptaTerminosCondiciones}
                  onValueChange={setAceptaTerminosCondiciones}
                  trackColor={{
                    false: palette.borderSoft,
                    true: palette.primarySoft,
                  }}
                  thumbColor={
                    aceptaTerminosCondiciones ? palette.primary : "#f4f4f5"
                  }
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Acepto tratamiento de datos (Ley 1581)
                </Text>
                <Switch
                  value={aceptaConsentimientoDatos}
                  onValueChange={setAceptaConsentimientoDatos}
                  trackColor={{
                    false: palette.borderSoft,
                    true: palette.primarySoft,
                  }}
                  thumbColor={
                    aceptaConsentimientoDatos ? palette.primary : "#f4f4f5"
                  }
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Acepto que no reemplaza el diagnóstico médico
                </Text>
                <Switch
                  value={aceptaDisclaimerMedico}
                  onValueChange={setAceptaDisclaimerMedico}
                  trackColor={{
                    false: palette.borderSoft,
                    true: palette.primarySoft,
                  }}
                  thumbColor={
                    aceptaDisclaimerMedico ? palette.primary : "#f4f4f5"
                  }
                />
              </View>
            </>
          ) : null}

          <Pressable
            style={[
              styles.submitButton,
              loading || legalPending ? styles.disabledButton : null,
            ]}
            onPress={handleSubmit}
            disabled={loading || legalPending}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegisterMode ? "Crear cuenta" : "Entrar"}
              </Text>
            )}
          </Pressable>

          {!isRegisterMode ? (
            <Pressable
              style={styles.forgotLink}
              onPress={() => navigation.navigate("ForgotPassword")}
              accessibilityLabel="Recuperar contraseña"
            >
              <Text style={styles.forgotLinkText}>
                ¿Olvidaste tu contraseña?
              </Text>
            </Pressable>
          ) : null}

          {legalPending ? (
            <Text style={styles.helperText}>
              Acepta los tres consentimientos para poder registrar.
            </Text>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o continúa con</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              style={styles.googleButton}
              onPress={() => handleSocialLogin("google")}
              disabled={loading || socialLoading !== null}
            >
              {socialLoading === "google" ? (
                <ActivityIndicator color={palette.textPrimary} size="small" />
              ) : (
                <>
                  <Ionicons
                    name="logo-google"
                    size={18}
                    color={palette.textPrimary}
                  />
                  <Text style={styles.socialButtonText}>Google</Text>
                </>
              )}
            </Pressable>

            {Platform.OS === "ios" ? (
              <Pressable
                style={styles.appleButton}
                onPress={() => handleSocialLogin("apple")}
                disabled={loading || socialLoading !== null}
              >
                {socialLoading === "apple" ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
                    <Text style={styles.appleButtonText}>Apple</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.switchLinkRow}>
            {isRegisterMode ? (
              <Pressable onPress={() => switchMode("login")}>
                <Text style={styles.switchLink}>
                  ¿Ya tienes cuenta?{" "}
                  <Text style={styles.switchLinkStrong}>Inicia sesión</Text>
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => switchMode("register")}>
                <Text style={styles.switchLink}>
                  ¿No tienes cuenta?{" "}
                  <Text style={styles.switchLinkStrong}>Regístrate</Text>
                </Text>
              </Pressable>
            )}
          </View>
        </GlassCard>
      </ScrollView>
    </AmbientBackdrop>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.35)",
    backgroundColor: palette.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    marginTop: 14,
    fontSize: 30,
    lineHeight: 34,
    color: palette.textPrimary,
    fontFamily: fonts.heading,
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 14,
    color: palette.textSecondary,
    lineHeight: 22,
    fontFamily: fonts.body,
  },
  modeRow: {
    marginTop: 4,
    flexDirection: "row",
    backgroundColor: palette.panelStrong,
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 10,
  },
  modeButtonActive: {
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.4)",
  },
  modeButtonText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  modeButtonTextActive: {
    color: palette.primary,
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    color: palette.textSecondary,
    fontFamily: fonts.body,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 12,
    backgroundColor: palette.surface,
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 12,
    backgroundColor: palette.surface,
  },
  passwordInput: {
    flex: 1,
    color: palette.textPrimary,
    fontFamily: fonts.bodyRegular,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  legalSwitchLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legalLink: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    paddingVertical: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
  dividerRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  forgotLink: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 4,
  },
  forgotLinkText: {
    color: palette.primary,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.borderSoft,
  },
  dividerText: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  socialRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  googleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: 12,
  },
  appleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    paddingVertical: 12,
  },
  socialButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  helperText: {
    marginTop: 10,
    color: palette.warning,
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
  },
  errorText: {
    marginTop: 12,
    color: palette.danger,
    fontFamily: fonts.body,
  },
  switchLinkRow: {
    marginTop: 16,
    alignItems: "center",
  },
  switchLink: {
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
  },
  switchLinkStrong: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
  },
});

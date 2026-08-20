import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AmbientBackdrop from "../../../components/AmbientBackdrop";
import GlassCard from "../../../components/GlassCard";
import { AppContext } from "../../../context/AppContext";
import { deleteMyAccount } from "../../../services/api";
import {
  clearLocalHealthData,
  getProfileSurvey,
  saveProfileSurvey,
} from "../../../services/localHealth";
import { fonts, palette } from "../../../theme/tokens";
import type { ProfileSurveyData } from "../../../types";

const APP_VERSION = "1.0.0";

function normalizeRisk(value: string | undefined) {
  if (typeof value !== "string") {
    return "Sin clasificar";
  }

  if (value.trim().length === 0) {
    return "Sin clasificar";
  }

  return value;
}

function boolLabel(value: boolean | null | undefined) {
  if (value === true) {
    return "Sí";
  }
  if (value === false) {
    return "No";
  }
  return "--";
}

const SURVEY_DEFAULT: Record<string, string | string[]> = {
  edad_rango: "",
  contextura: "",
  cuello_rango: "",
  tabaquismo: "",
  alcohol_nocturno: "",
  actividad_fisica: "",
  somnolencia_diurna: "",
  medicamento_noche: "",
  comorbilidades: [],
};

const SURVEY_QUESTIONS = [
  {
    key: "edad_rango",
    title: "Rango de edad",
    options: ["18-29", "30-39", "40-49", "50-59", "60+"],
  },
  {
    key: "contextura",
    title: "Contextura corporal",
    options: ["Delgada", "Media", "Robusta"],
  },
  {
    key: "cuello_rango",
    title: "Perímetro de cuello estimado",
    options: ["Pequeño", "Medio", "Grande"],
  },
  {
    key: "somnolencia_diurna",
    title: "Somnolencia durante el día",
    options: ["Nunca", "A veces", "Frecuente"],
  },
  {
    key: "tabaquismo",
    title: "Consumo de tabaco",
    options: ["No", "Ocasional", "Diario"],
  },
  {
    key: "alcohol_nocturno",
    title: "Alcohol por la noche",
    options: ["No", "1-2 noches/semana", "3+ noches/semana"],
  },
  {
    key: "actividad_fisica",
    title: "Actividad física semanal",
    options: ["Baja", "Moderada", "Alta"],
  },
  {
    key: "medicamento_noche",
    title: "Uso de medicación para dormir",
    options: ["No", "Ocasional", "Frecuente"],
  },
];

const COMORBIDITIES = [
  "Ninguna",
  "Hipertensión",
  "Diabetes",
  "Rinitis o congestión nasal",
  "Tiroides",
  "Ansiedad o depresión",
  "Enfermedad pulmonar",
];

export default function ProfileHomeScreen({ navigation }: { navigation: any }) {
  const { user, signOut } = useContext(AppContext);
  const [closingSession, setClosingSession] = useState(false);
  const [error, setError] = useState("");
  const [showSurvey, setShowSurvey] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);

  const [showDeleteData, setShowDeleteData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  const [survey, setSurvey] =
    useState<Record<string, string | string[]>>(SURVEY_DEFAULT);

  const fullName = useMemo(
    () => user?.nombre_completo || user?.full_name || "Paciente A.S.A.P.",
    [user],
  );
  const email = useMemo(() => user?.email || "--", [user]);
  const apneaRisk = useMemo(
    () => normalizeRisk(user?.riesgo_apnea_predicho || user?.apnea_risk),
    [user],
  );

  useEffect(() => {
    async function loadSurvey() {
      const payload = await getProfileSurvey();
      if (payload && typeof payload === "object") {
        setSurvey((prev) => ({
          ...prev,
          ...payload,
          comorbilidades: Array.isArray(payload.comorbilidades)
            ? payload.comorbilidades
            : [],
        }));
      }
    }

    loadSurvey();
  }, []);

  const handleSignOut = async () => {
    setClosingSession(true);
    setError("");

    try {
      await signOut();
    } catch {
      setError("No fue posible cerrar sesión en este momento.");
    } finally {
      setClosingSession(false);
    }
  };

  const handleSaveSurvey = async () => {
    setSavingSurvey(true);
    setError("");

    try {
      await saveProfileSurvey(survey);
      setShowSurvey(false);
    } catch {
      setError("No fue posible guardar la encuesta.");
    } finally {
      setSavingSurvey(false);
    }
  };

  const handleDeleteLocalData = async () => {
    setDeletingData(true);
    setError("");

    try {
      await deleteMyAccount();
      await clearLocalHealthData();
      setShowDeleteData(false);
      await signOut();
    } catch {
      setError(
        "No fue posible borrar tus datos. Verifica tu conexión e inténtalo de nuevo.",
      );
      setShowDeleteData(false);
    } finally {
      setDeletingData(false);
    }
  };

  const updateField = (name: string, value: string) => {
    setSurvey((prev) => ({ ...prev, [name]: value }));
  };

  const toggleComorbidity = (value: string) => {
    setSurvey((prev) => {
      const current = Array.isArray(prev.comorbilidades)
        ? prev.comorbilidades
        : [];

      if (value === "Ninguna") {
        return { ...prev, comorbilidades: ["Ninguna"] };
      }

      const filtered = current.filter((item) => item !== "Ninguna");
      if (filtered.includes(value)) {
        return {
          ...prev,
          comorbilidades: filtered.filter((item) => item !== value),
        };
      }

      return { ...prev, comorbilidades: [...filtered, value] };
    });
  };

  return (
    <AmbientBackdrop>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.badge}>Perfil</Text>
        <Text style={styles.title}>Cuenta y salud personal</Text>
        <Text style={styles.subtitle}>
          Completa tu información para mejorar el análisis de tu riesgo de
          apnea.
        </Text>

        <GlassCard style={styles.profileCard}>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{email}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Riesgo predicho</Text>
              <Text style={styles.infoValue}>{apneaRisk}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Ronca habitualmente</Text>
              <Text style={styles.infoValue}>
                {boolLabel(user?.ronca_habitualmente)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Cansancio diurno</Text>
              <Text style={styles.infoValue}>
                {boolLabel(user?.cansancio_diurno)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Consentimiento datos</Text>
              <Text style={styles.infoValue}>
                {boolLabel(user?.acepta_consentimiento_datos)}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setShowSurvey(true)}
            style={({ pressed }) => [
              styles.surveyButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.surveyButtonText}>
              Ayúdanos a conocerte mejor
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.getParent()?.navigate("HistoryTab")}
            style={({ pressed }) => [
              styles.ghostButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.ghostButtonText}>Ver historial completo</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("EmergencyAlerts")}
            style={({ pressed }) => [
              styles.emergencyButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.emergencyButtonText}>
              Configurar alertas de apnea severa
            </Text>
          </Pressable>

          <View style={styles.linksRow}>
            <Pressable
              onPress={() => navigation.navigate("PrivacyPolicy")}
              style={({ pressed }) => [
                styles.linkButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.linkButtonText}>Política de privacidad</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("ContactSupport")}
              style={({ pressed }) => [
                styles.linkButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={styles.linkButtonText}>Contacto y soporte</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => setShowDeleteData(true)}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.deleteButtonText}>
              Borrar mi cuenta y datos
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            disabled={closingSession}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed ? styles.pressed : null,
              closingSession ? styles.disabled : null,
            ]}
          >
            {closingSession ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signOutText}>Cerrar sesión</Text>
            )}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </GlassCard>

        <GlassCard>
          <Text style={styles.legalTitle}>Aviso médico</Text>
          <Text style={styles.legalText}>
            A.S.A.P. es una herramienta de apoyo para el monitoreo de apneas y
            no reemplaza diagnóstico ni tratamiento médico profesional.
          </Text>
        </GlassCard>

        <Text style={styles.version}>A.S.A.P. · v{APP_VERSION}</Text>
      </ScrollView>

      <Modal
        visible={showDeleteData}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteData(false)}
      >
        <View style={styles.deleteBackdrop}>
          <View style={styles.deleteCard}>
            <Text style={styles.deleteTitle}>
              ¿Borrar tu cuenta y todos tus datos?
            </Text>
            <Text style={styles.deleteText}>
              Se eliminarán de forma permanente tu cuenta, tus sesiones de
              monitoreo y tus datos de salud en la nube, junto con la encuesta,
              el diario, las preferencias y las alertas guardadas en este
              celular. Esta acción no se puede deshacer.
            </Text>
            <View style={styles.deleteActions}>
              <Pressable
                style={styles.deleteCancel}
                onPress={() => setShowDeleteData(false)}
              >
                <Text style={styles.deleteCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.deleteConfirm}
                onPress={handleDeleteLocalData}
                disabled={deletingData}
              >
                {deletingData ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.deleteConfirmText}>
                    Borrar cuenta y datos
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSurvey}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSurvey(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Mejorar datos personales para mayor precisión
            </Text>
            <Text style={styles.modalSubtitle}>
              Selecciona opciones sugeridas. Así reducimos errores y mejoramos
              recomendaciones.
            </Text>

            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={styles.modalFormContent}
            >
              {SURVEY_QUESTIONS.map((question) => (
                <View key={question.key} style={styles.questionCard}>
                  <Text style={styles.questionTitle}>{question.title}</Text>
                  <View style={styles.chipWrap}>
                    {question.options.map((option) => {
                      const selected = survey[question.key] === option;
                      return (
                        <Pressable
                          key={`${question.key}-${option}`}
                          onPress={() => updateField(question.key, option)}
                          style={({ pressed }) => [
                            styles.chip,
                            selected ? styles.chipSelected : null,
                            pressed ? styles.pressed : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selected ? styles.chipTextSelected : null,
                            ]}
                          >
                            {option}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <View style={styles.questionCard}>
                <Text style={styles.questionTitle}>
                  Condiciones de salud asociadas (puedes elegir varias)
                </Text>
                <View style={styles.chipWrap}>
                  {COMORBIDITIES.map((option) => {
                    const selected =
                      Array.isArray(survey.comorbilidades) &&
                      survey.comorbilidades.includes(option);
                    return (
                      <Pressable
                        key={`comorbidity-${option}`}
                        onPress={() => toggleComorbidity(option)}
                        style={({ pressed }) => [
                          styles.chip,
                          selected ? styles.chipSelected : null,
                          pressed ? styles.pressed : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selected ? styles.chipTextSelected : null,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalGhost}
                onPress={() => setShowSurvey(false)}
              >
                <Text style={styles.modalGhostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={handleSaveSurvey}
                disabled={savingSurvey}
              >
                {savingSurvey ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.35)",
    backgroundColor: palette.primarySoft,
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    textTransform: "uppercase",
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
  profileCard: {
    borderColor: "rgba(37,99,235,0.28)",
    backgroundColor: palette.surface,
  },
  name: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 28,
    lineHeight: 32,
  },
  email: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
  },
  infoGrid: {
    marginTop: 14,
    gap: 8,
  },
  infoItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  infoValue: {
    marginTop: 5,
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  surveyButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.36)",
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    paddingVertical: 11,
  },
  surveyButtonText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
  },
  ghostButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    alignItems: "center",
    paddingVertical: 11,
  },
  ghostButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  emergencyButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.45)",
    backgroundColor: palette.dangerSoft,
    alignItems: "center",
    paddingVertical: 11,
  },
  emergencyButtonText: {
    color: palette.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  linksRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  linkButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    alignItems: "center",
    paddingVertical: 11,
  },
  linkButtonText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  deleteButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.45)",
    backgroundColor: palette.dangerSoft,
    alignItems: "center",
    paddingVertical: 11,
  },
  deleteButtonText: {
    color: palette.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  signOutButton: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: palette.danger,
    alignItems: "center",
    paddingVertical: 12,
  },
  signOutText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.62,
  },
  errorText: {
    marginTop: 10,
    color: palette.danger,
    fontFamily: fonts.bodyRegular,
    lineHeight: 18,
  },
  legalTitle: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontSize: 11,
  },
  legalText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  version: {
    color: palette.textMuted,
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    textAlign: "center",
  },
  deleteBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  deleteCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    padding: 18,
  },
  deleteTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  deleteText: {
    marginTop: 8,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  deleteActions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  deleteCancel: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    paddingVertical: 11,
  },
  deleteCancelText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  deleteConfirm: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  deleteConfirmText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    padding: 16,
    maxHeight: "86%",
  },
  modalTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.headingMedium,
    fontSize: 20,
  },
  modalSubtitle: {
    marginTop: 6,
    color: palette.textSecondary,
    fontFamily: fonts.bodyRegular,
    lineHeight: 20,
  },
  modalForm: {
    marginTop: 12,
  },
  modalFormContent: {
    gap: 10,
    paddingBottom: 12,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: 12,
    backgroundColor: palette.panelStrong,
    padding: 10,
  },
  questionTitle: {
    color: palette.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  chipWrap: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    borderColor: "rgba(37,99,235,0.68)",
    backgroundColor: palette.primarySoft,
  },
  chipText: {
    color: palette.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  chipTextSelected: {
    color: palette.primary,
  },
  modalActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  modalGhost: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    paddingVertical: 10,
  },
  modalGhostText: {
    color: palette.textPrimary,
    fontFamily: fonts.body,
  },
  modalPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    paddingVertical: 10,
  },
  modalPrimaryText: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
  },
});

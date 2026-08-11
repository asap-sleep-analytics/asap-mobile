/**
 * EJEMPLO: Integración de useApneaDetection en MonitorActiveScreen
 *
 * Este archivo muestra cómo agregar la funcionalidad de predicción de apnea
 * a la pantalla de monitoreo activo existente.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useApneaDetection } from '../hooks/useApneaDetection';
import ApneaResultCard from '../components/ApneaResultCard';
import { palette, fonts } from '../theme/tokens';
import type { ApneaPrediction, MonitorMode } from '../types';

interface ApneaPredictionSectionProps {
  monitoringMode?: MonitorMode;
  spo2Values?: number[];
  ambientNoiseLevel?: number;
  onPredictionComplete?: (result: ApneaPrediction) => void;
}

/**
 * Sub-componente que maneja la predicción de apnea
 * Puede ser agregado dentro de MonitorActiveScreen
 */
export function ApneaPredictionSection({
  monitoringMode = 'cell_only',
  spo2Values = [],
  ambientNoiseLevel = 45,
  onPredictionComplete,
}: ApneaPredictionSectionProps) {
  const apnea = useApneaDetection({
    modo: monitoringMode === 'cell_oximeter' ? 'seguimiento' : 'screening',
    perfil: 'general',
  });

  const [predictions, setPredictions] = useState<ApneaPrediction[]>([]);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const autoAnalysisRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Inicia análisis automático cada 30 segundos
   */
  const startAutoAnalysis = useCallback(async () => {
    if (autoAnalysisRef.current) return; // Ya corriendo

    setIsAutoAnalyzing(true);

    const performAnalysis = async () => {
      try {
        // Obtener lecturas recientes de SpO2 (último minuto)
        const recentSpo2 = spo2Values.slice(-60).length > 0 ? spo2Values.slice(-60) : [95, 94, 93, 91];

        // Ejecutar predicción
        const result = await apnea.stopAndPredict(recentSpo2);
        if (!result) return;

        // Guardar predicción
        setPredictions((prev) => [...prev.slice(-9), result]); // Guardar últimas 10

        // Callback opcional
        if (onPredictionComplete) {
          onPredictionComplete(result);
        }

        // Si hay evento crítico, retornar true para que la app tome acciones
        if (result.nivel === 'CRITICO') {
          return true;
        }

        // Reiniciar grabación para próximo análisis
        await apnea.startRecording();
      } catch (err) {
        console.error('Error en análisis automático:', err);
      }
    };

    // Análisis inicial
    await apnea.startRecording();

    // Programar análisis cada 30 segundos
    autoAnalysisRef.current = setInterval(async () => {
      await performAnalysis();
    }, 30000);
  }, [apnea, spo2Values, onPredictionComplete]);

  /**
   * Detiene análisis automático
   */
  const stopAutoAnalysis = useCallback(async () => {
    if (autoAnalysisRef.current) {
      clearInterval(autoAnalysisRef.current);
      autoAnalysisRef.current = null;
    }
    await apnea.cancelRecording();
    setIsAutoAnalyzing(false);
    setPredictions([]);
  }, [apnea]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoAnalysisRef.current) {
        clearInterval(autoAnalysisRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.title}>Análisis de Apnea</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{isAutoAnalyzing ? 'Activo' : 'Inactivo'}</Text>
        </View>
      </View>

      {/* Botones de control */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.button, isAutoAnalyzing && styles.buttonDisabled]}
          onPress={startAutoAnalysis}
          disabled={isAutoAnalyzing || apnea.isRecording}
        >
          <Text style={styles.buttonText}>Iniciar Análisis</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.buttonSecondary, !isAutoAnalyzing && styles.buttonDisabled]}
          onPress={stopAutoAnalysis}
          disabled={!isAutoAnalyzing}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Detener</Text>
        </Pressable>
      </View>

      {/* Indicador de estado */}
      {(apnea.isRecording || apnea.isProcessing) && (
        <View style={styles.statusIndicator}>
          <ActivityIndicator size="small" color={palette.mint} />
          <Text style={styles.statusIndicatorText}>
            {apnea.isRecording
              ? `Grabando: ${(apnea.elapsedMs / 1000).toFixed(1)}s / 30s`
              : 'Procesando predicción...'}
          </Text>
        </View>
      )}

      {/* Barra de progreso */}
      {apnea.isRecording && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressBar, { width: `${apnea.progressPercent}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{apnea.progressPercent.toFixed(0)}%</Text>
        </View>
      )}

      {/* Historial de predicciones */}
      {predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <Text style={styles.predictionsTitle}>Predicciones Recientes</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.predictionsScroll}
          >
            {predictions.map((pred, idx) => (
              <View key={idx} style={styles.predictionCard}>
                <ApneaResultCard result={pred} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Mensaje de error */}
      {apnea.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {apnea.error}</Text>
        </View>
      )}

      {/* Información de SpO2 */}
      {spo2Values.length > 0 && (
        <View style={styles.spo2Info}>
          <Text style={styles.spo2Label}>Lecturas SpO2 disponibles:</Text>
          <Text style={styles.spo2Value}>{spo2Values.length} registros</Text>
        </View>
      )}
    </View>
  );
}

/**
 * CÓMO INTEGRAR EN MONITORACTIVESCREEN:
 *
 * 1. En el componente MonitorActiveScreen, agregá:
 *
 *    import { ApneaPredictionSection } from '../components/ApneaPredictionSection';
 *
 * 2. Dentro del render, añadí:
 *
 *    <ApneaPredictionSection
 *      monitoringMode={monitoringMode}
 *      spo2Values={spo2ReadingsArray}  // Array con lecturas de SpO2
 *      ambientNoiseLevel={ambientNoiseLevel}
 *      onPredictionComplete={(result) => {
 *        if (result.nivel === 'CRITICO') {
 *          // Trigger alerta severa
 *          triggerSevereApneaAlert(...)
 *        }
 *      }}
 *    />
 *
 * 3. Mantén un array de lecturas de SpO2 actualizadas:
 *
 *    const [spo2Readings, setSpo2Readings] = useState([]);
 *
 *    // Cuando recibas una lectura del oxímetro:
 *    setSpo2Readings(prev => [...prev, oximeterReading]);
 */

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  title: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: '#1F2937',
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
  },

  statusText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: palette.mint,
  },

  controls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },

  button: {
    flex: 1,
    backgroundColor: palette.mint,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },

  buttonSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },

  buttonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  buttonTextSecondary: {
    color: '#374151',
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },

  statusIndicatorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: palette.mint,
  },

  progressContainer: {
    marginBottom: 16,
  },

  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },

  progressBar: {
    height: '100%',
    backgroundColor: palette.mint,
    borderRadius: 3,
  },

  progressText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'right',
  },

  predictionsContainer: {
    marginBottom: 12,
  },

  predictionsTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: '#374151',
    marginBottom: 8,
  },

  predictionsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },

  predictionCard: {
    marginRight: 12,
    flex: 1,
    minWidth: 280,
  },

  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  errorText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: '#991B1B',
  },

  spo2Info: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  spo2Label: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: '#0369A1',
  },

  spo2Value: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: palette.mint,
  },
});

export default ApneaPredictionSection;

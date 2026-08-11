/**
 * GUÍA DE INTEGRACIÓN: useApneaDetection Hook
 *
 * Este documento explica cómo integrar la detección automática de apnea
 * en la app React Native usando el hook useApneaDetection y el endpoint /predict.
 */

// ============================================================================
// 1. SETUP BÁSICO EN TU COMPONENTE
// ============================================================================

import { useApneaDetection } from '../hooks/useApneaDetection';
import ApneaResultCard from '../components/ApneaResultCard';

export default function MyMonitorScreen() {
  // Inicializar el hook con opciones
  const apnea = useApneaDetection({
    modo: 'screening', // 'screening' o 'seguimiento'
    perfil: 'general', // 'general' o 'matias'
    autoStart: false, // Si true, inicia grabación automáticamente
  });

  // Ahora puedes usar:
  // - apnea.isRecording: boolean
  // - apnea.isProcessing: boolean
  // - apnea.result: objeto con nivel, interpretación, probabilidades
  // - apnea.error: string con mensajes de error
  // - apnea.elapsedMs: tiempo transcurrido en ms
  // - apnea.progressPercent: 0-100%
  //
  // Métodos:
  // - apnea.startRecording(): inicia grabación
  // - apnea.stopAndPredict(spo2Values): detiene, envía, recibe predicción
  // - apnea.cancelRecording(): cancela grabación actual
  // - apnea.clearResult(): limpia resultado anterior

  return (
    <View>
      {/* Mostrar estado de grabación */}
      {apnea.isRecording && (
        <Text>Grabando... {apnea.progressPercent.toFixed(0)}%</Text>
      )}

      {/* Mostrar resultado */}
      <ApneaResultCard result={apnea.result} />

      {/* Mostrar errores */}
      {apnea.error && <Text style={{ color: 'red' }}>{apnea.error}</Text>}
    </View>
  );
}

// ============================================================================
// 2. FLUJO DE GRABACIÓN MANUAL (Para aplicaciones interactivas)
// ============================================================================

export function ManualRecordingExample() {
  const apnea = useApneaDetection({ modo: 'screening' });
  const [spo2Reading, setSpo2Reading] = useState([95, 94, 93, 91]);

  const handleStartRecording = async () => {
    await apnea.startRecording();
  };

  const handleStopAndAnalyze = async () => {
    try {
      // Pasar valores de SpO2 del oxímetro
      await apnea.stopAndPredict(spo2Reading);
    } catch (err) {
      console.error('Error durante predicción:', err);
    }
  };

  const handleCancel = async () => {
    await apnea.cancelRecording();
  };

  return (
    <View>
      <Pressable onPress={handleStartRecording} disabled={apnea.isRecording || apnea.isProcessing}>
        <Text>Iniciar Grabación</Text>
      </Pressable>

      {apnea.isRecording && (
        <>
          <Text>Tiempo: {(apnea.elapsedMs / 1000).toFixed(1)}s / 30s</Text>
          <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3 }}>
            <View
              style={{
                height: '100%',
                width: `${apnea.progressPercent}%`,
                backgroundColor: '#3B82F6',
                borderRadius: 3,
              }}
            />
          </View>

          <Pressable onPress={handleStopAndAnalyze} disabled={apnea.isProcessing}>
            <Text>Analizar Ahora</Text>
          </Pressable>

          <Pressable onPress={handleCancel} disabled={apnea.isProcessing}>
            <Text>Cancelar</Text>
          </Pressable>
        </>
      )}

      {apnea.isProcessing && <Text>Procesando predicción...</Text>}

      <ApneaResultCard result={apnea.result} />
    </View>
  );
}

// ============================================================================
// 3. GRABACIÓN PASIVA AUTOMÁTICA (Para monitoreo durante el sueño)
// ============================================================================

export function PassiveMonitoringExample() {
  const apnea = useApneaDetection({ modo: 'seguimiento', perfil: 'matias' });
  const [spo2Readings, setSpo2Readings] = useState([]);
  const [predictions, setPredictions] = useState([]);

  // Cada 30 segundos, automatiza grabación + predicción
  useEffect(() => {
    let recordingInterval = null;

    const performSegmentAnalysis = async () => {
      try {
        // 1. Obtener últimas lecturas de SpO2 (últimos 30 segundos)
        // En una app real, esto vendría del oxímetro conectado
        const recentReadings = spo2Readings.slice(-30); // Últimas 30 lecturas
        if (recentReadings.length === 0) {
          console.warn('No hay lecturas de SpO2');
          return;
        }

        // 2. Hacer predicción con los datos
        const result = await apnea.stopAndPredict(recentReadings);

        // 3. Guardar resultado
        setPredictions((prev) => [...prev, result]);

        // 4. Opcional: Ejecutar acciones basadas en nivel
        if (result.nivel === 'CRITICO') {
          // Trigger alerta severa
          console.warn('¡Evento crítico detectado!');
          triggerAlert(result);
        } else if (result.nivel === 'ALERTA') {
          // Notificar usuario discretamente
          console.log('Evento respiratorio posible');
        }
      } catch (err) {
        console.error('Error en análisis pasivo:', err);
      }
    };

    // Iniciar grabación en cada intervalo
    recordingInterval = setInterval(async () => {
      // Si no está grabando, inicia
      if (!apnea.isRecording && !apnea.isProcessing) {
        await apnea.startRecording();

        // Después de 30s, analizar automáticamente
        setTimeout(performSegmentAnalysis, 30000);
      }
    }, 35000); // Comienza nuevo segmento cada 35s

    return () => {
      if (recordingInterval) clearInterval(recordingInterval);
    };
  }, [apnea, spo2Readings]);

  // Simular lecturas de oxímetro cada segundo
  useEffect(() => {
    const oximeterSimulation = setInterval(() => {
      setSpo2Readings((prev) => [...prev, 95 + Math.random() * 5 - 2.5]);
    }, 1000);

    return () => clearInterval(oximeterSimulation);
  }, []);

  return (
    <ScrollView>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Monitoreo Pasivo</Text>

      <Text>Estado: {apnea.isRecording ? 'Grabando' : apnea.isProcessing ? 'Procesando' : 'En espera'}</Text>
      <Text>Predicciones: {predictions.length}</Text>

      {predictions.map((pred, idx) => (
        <ApneaResultCard key={idx} result={pred} />
      ))}
    </ScrollView>
  );
}

// ============================================================================
// 4. INTEGRACIÓN EN MONITORACTIVESCREEN
// ============================================================================

/**
 * Ejemplo de integración en MonitorActiveScreen existente
 */
export function IntegrationInMonitorActiveScreen() {
  const apnea = useApneaDetection({
    modo: 'seguimiento',
    perfil: 'general',
  });
  const [spo2Values, setSpo2Values] = useState([95, 94, 93, 91]);
  const [analysisResults, setAnalysisResults] = useState([]);

  // Hook para capturar y analizar fragmentos cada 30s
  useEffect(() => {
    let analysisTimer = null;

    const analyzeCurrentSegment = async () => {
      if (!apnea.isRecording && !apnea.isProcessing && analysisTimer === null) {
        try {
          // Obtener últimas lecturas de SpO2 del contexto/estado
          // Ejemplo: si tienes un contexto OximeterContext:
          // const { currentReadings } = useContext(OximeterContext);
          // const recentSpo2 = currentReadings.slice(-30);

          const prediction = await apnea.stopAndPredict(spo2Values);
          setAnalysisResults((prev) => [...prev.slice(-9), prediction]); // Guardar últimas 10 predicciones

          // Iniciar nueva grabación automáticamente
          await apnea.startRecording();

          // Programar próximo análisis en 30s
          analysisTimer = setTimeout(() => {
            analysisTimer = null;
            analyzeCurrentSegment();
          }, 30000);
        } catch (err) {
          console.error('Error en análisis:', err);
        }
      }
    };

    // Iniciar primer análisis
    apnea.startRecording();
    analysisTimer = setTimeout(() => {
      analysisTimer = null;
      analyzeCurrentSegment();
    }, 30000);

    return () => {
      if (analysisTimer) clearTimeout(analysisTimer);
    };
  }, [apnea, spo2Values]);

  return (
    <View>
      {/* Mostrar últimas predicciones */}
      {analysisResults.length > 0 && (
        <View>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>Últimas Predicciones</Text>
          {analysisResults.slice(-3).map((result, idx) => (
            <ApneaResultCard key={idx} result={result} />
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// 5. VARIABLES DE ENTORNO REQUERIDAS
// ============================================================================

/**
 * En tu archivo .env:
 *
 * EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:8000
 *
 * El hook usará esta URL para hacer las predicciones.
 * En simuladores/emuladores: http://10.0.2.2:8000 (Android) o http://127.0.0.1:8000 (iOS)
 * En dispositivos físicos: http://<tu-ip-local>:8000
 */

// ============================================================================
// 6. RESPUESTA DEL ENDPOINT /predict
// ============================================================================

/**
 * La predicción retorna un objeto con esta estructura:
 *
 * {
 *   "nivel": "NORMAL" | "ALERTA" | "CRITICO",
 *   "interpretacion": "Sin eventos detectados en este segmento.",
 *   "probabilidad": 0.3215,
 *   "detalle": {
 *     "prob_audio": 0.28,
 *     "prob_spo2": 0.31,
 *     "spo2_drop_pts": 3.2,
 *     "peso_audio": 0.5,
 *     "peso_spo2": 0.5
 *   },
 *   "modo": "screening",
 *   "perfil": "general",
 *   "version": "v3_universal_dual_mode"
 * }
 */

// ============================================================================
// 7. ERRORES COMUNES Y SOLUCIONES
// ============================================================================

/**
 * ERROR: "Permiso de micrófono denegado"
 * SOLUCIÓN: Asegúrate de que la app tiene permiso de audio en Info.plist (iOS) y AndroidManifest.xml (Android)
 *
 * ERROR: "No hay grabación activa"
 * SOLUCIÓN: Llama a startRecording() antes de stopAndPredict()
 *
 * ERROR: "Error al procesar la grabación"
 * SOLUCIÓN: Verifica que el servidor esté corriendo y EXPO_PUBLIC_API_BASE_URL sea correcta
 *
 * ERROR: "Formato SpO2 inválido"
 * SOLUCIÓN: Asegúrate de pasar un array de números o string separado por comas
 *
 * ERROR: "Audio demasiado corto"
 * SOLUCIÓN: El endpoint requiere mínimo 2 segundos de audio. 30s es lo ideal.
 */

// ============================================================================
// 8. TIPS Y BUENAS PRÁCTICAS
// ============================================================================

/**
 * ✅ HAZ:
 * - Pasar valores reales de SpO2 del oxímetro
 * - Usar 'seguimiento' para pacientes diagnosticados, 'screening' para general
 * - Guardar resultados para análisis histórico
 * - Validar que el servidor esté disponible antes de iniciar
 * - Mostrar feedback visual del progreso de grabación
 * - Manejar errores de red con reintentos
 *
 * ❌ NO HAGAS:
 * - Iniciar múltiples grabaciones simultáneamente
 * - Enviar audio sin SpO2 (el modelo necesita ambos)
 * - Cancelar la grabación demasiado pronto (<10 segundos)
 * - Ignorar la URL base del entorno (hardcodear IPs)
 * - Esperar que funcione sin permisos de micrófono
 */

export default function GuideComponent() {
  return (
    <View>
      <Text>Ver el código de este archivo para ejemplos completos de integración</Text>
    </View>
  );
}

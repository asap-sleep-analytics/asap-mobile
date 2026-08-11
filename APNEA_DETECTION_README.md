# Integración del Endpoint `/predict` - A.S.A.P Mobile

## 📋 Resumen

Se ha implementado una integración completa del endpoint `/api/sleep/v3/predict` de FastAPI en la app React Native ASAP Mobile. Esto permite realizar predicciones de apnea del sueño de forma automática o manual, combinando:

- **Audio grabado**: 30 segundos de audio pasivo del usuario
- **Valores SpO2**: Lecturas de saturación de oxígeno del oxímetro
- **Modelo v3**: Algoritmo de ML que detecta eventos respiratorios

## 🎯 Características Principales

✅ **Hook Personalizado**: `useApneaDetection` - Gestión completa de grabación y predicción
✅ **Componente de Visualización**: `ApneaResultCard` - Muestra resultados con código de colores
✅ **Componente de Integración**: `ApneaPredictionSection` - Listo para agregar a pantallas existentes
✅ **Función API**: `predictApnea` - Comunicación con el backend

## 📁 Archivos Creados

```
src/
├── hooks/
│   ├── useApneaDetection.ts          # Hook principal
│   ├── APNEA_DETECTION_GUIDE.js      # Guía completa con ejemplos
│   └── index.ts                      # Exports
├── components/
│   ├── ApneaResultCard.tsx           # Card de visualización
│   └── ApneaPredictionSection.tsx    # Componente integrable
└── services/
    └── api.js (modificado)           # Función predictApnea agregada
```

## 🚀 Uso Rápido

### 1. En tu componente, importa el hook:

```tsx
import { useApneaDetection } from '../hooks/useApneaDetection';
import ApneaResultCard from '../components/ApneaResultCard';
```

### 2. Inicializa el hook:

```tsx
const apnea = useApneaDetection({
  modo: 'screening',      // 'screening' o 'seguimiento'
  perfil: 'general',      // 'general' o 'matias'
  autoStart: false,       // Si true, inicia automáticamente
});
```

### 3. Controla la grabación:

```tsx
// Iniciar grabación
await apnea.startRecording();

// Después de 30s, detener y predecir
const prediction = await apnea.stopAndPredict([95, 94, 93, 91]);

// Mostrar resultado
<ApneaResultCard result={prediction} />
```

## 📊 Respuesta del Endpoint

La predicción retorna:

```json
{
  "nivel": "NORMAL",
  "interpretacion": "Sin eventos detectados en este segmento.",
  "probabilidad": 0.3215,
  "detalle": {
    "prob_audio": 0.28,
    "prob_spo2": 0.31,
    "spo2_drop_pts": 3.2,
    "peso_audio": 0.5,
    "peso_spo2": 0.5
  },
  "modo": "screening",
  "perfil": "general",
  "version": "v3_universal_dual_mode"
}
```

### Niveles

| Nivel | Color | Significado |
|-------|-------|-------------|
| **NORMAL** | 🟢 Verde | Sin eventos detectados |
| **ALERTA** | 🟡 Amarillo | Posible evento respiratorio |
| **CRÍTICO** | 🔴 Rojo | Evento severo detectado |

## 🔧 API Reference

### Hook: `useApneaDetection`

#### Opciones

```typescript
{
  modo: 'screening' | 'seguimiento';      // Modo clínico (default: 'screening')
  perfil: 'general' | 'matias';           // Perfil del paciente (default: 'general')
  autoStart: boolean;                     // Iniciar automáticamente (default: false)
}
```

#### Estados

```typescript
apnea.isRecording      // boolean - Está grabando
apnea.isProcessing     // boolean - Procesando predicción
apnea.result           // Object | null - Resultado de predicción
apnea.error            // string - Mensaje de error
apnea.elapsedMs        // number - Tiempo transcurrido en ms
apnea.progressPercent  // number - 0-100% de progreso
```

#### Métodos

```typescript
// Iniciar grabación
await apnea.startRecording()

// Detener, procesar y predecir
// spo2Values: Array<number> - Valores de SpO2 (ej: [95, 94, 93, 91])
// Returns: Promise<PredictionResult>
const result = await apnea.stopAndPredict(spo2Values)

// Cancelar grabación actual
await apnea.cancelRecording()

// Limpiar resultado anterior
apnea.clearResult()

// Obtener color según nivel
const color = apnea.levelColor()  // Returns: string (hex color)
```

### Función API: `predictApnea`

```typescript
import { predictApnea } from '../services/api';

const result = await predictApnea({
  audioFile: File,                    // Archivo WAV (de useApneaDetection)
  spo2: string,                       // Ej: "95,94,93,91"
  modo?: 'screening' | 'seguimiento', // Default: 'screening'
  perfil?: 'general' | 'matias',     // Default: 'general'
});
```

## 💡 Ejemplos de Implementación

### Opción 1: Análisis Manual (Usuario controla)

```tsx
export function ManualAnalysisScreen() {
  const apnea = useApneaDetection({ modo: 'screening' });

  const handleStartRecording = async () => {
    await apnea.startRecording();
  };

  const handleAnalyze = async () => {
    try {
      const result = await apnea.stopAndPredict([95, 94, 93, 91]);
      console.log('Predicción:', result);
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <View>
      <Pressable onPress={handleStartRecording}>
        <Text>Iniciar</Text>
      </Pressable>

      {apnea.isRecording && (
        <Text>{(apnea.elapsedMs / 1000).toFixed(1)}s / 30s</Text>
      )}

      <Pressable onPress={handleAnalyze}>
        <Text>Analizar</Text>
      </Pressable>

      <ApneaResultCard result={apnea.result} />
    </View>
  );
}
```

### Opción 2: Análisis Pasivo Automático

```tsx
export function PassiveMonitoringScreen() {
  const apnea = useApneaDetection({ modo: 'seguimiento' });
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    let interval = null;

    const analyzeSegment = async () => {
      try {
        const result = await apnea.stopAndPredict([95, 94, 93, 91]);
        setPredictions(prev => [...prev.slice(-9), result]);

        // Reiniciar grabación
        await apnea.startRecording();
      } catch (err) {
        console.error('Error:', err);
      }
    };

    // Iniciar análisis cada 30 segundos
    apnea.startRecording();
    interval = setInterval(analyzeSegment, 30000);

    return () => clearInterval(interval);
  }, [apnea]);

  return (
    <ScrollView>
      {predictions.map((pred, i) => (
        <ApneaResultCard key={i} result={pred} />
      ))}
    </ScrollView>
  );
}
```

### Opción 3: Usando ApneaPredictionSection

```tsx
import { ApneaPredictionSection } from '../components/ApneaPredictionSection';

export function MonitorActiveScreen() {
  const [spo2Readings, setSpo2Readings] = useState([]);

  return (
    <View>
      <ApneaPredictionSection
        monitoringMode="cell_oximeter"
        spo2Values={spo2Readings}
        onPredictionComplete={(result) => {
          if (result.nivel === 'CRITICO') {
            triggerAlert();
          }
        }}
      />
    </View>
  );
}
```

## ⚙️ Configuración Requerida

### .env

```env
# URL base de la API (importante: sin /api al final)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:8000

# Para diferentes entornos:
# Simulador iOS: http://127.0.0.1:8000
# Emulador Android: http://10.0.2.2:8000
# Dispositivo físico: http://<tu-ip-local>:8000
```

### Permisos

El hook requiere permiso de micrófono. Ya debe estar configurado en:
- `ios/ASAP/Info.plist` - `NSMicrophoneUsageDescription`
- `android/app/src/main/AndroidManifest.xml` - `RECORD_AUDIO`

## 🐛 Resolución de Problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| "Permiso denegado" | Falta permiso de micrófono | Verifica Info.plist/AndroidManifest.xml |
| "No hay grabación activa" | Llamas stopAndPredict() sin startRecording() | Llama startRecording() primero |
| "Audio demasiado corto" | Grabaste <2 segundos | Espera mínimo 2-3 segundos |
| Error 404 en `/predict` | URL incorrecta del API | Verifica EXPO_PUBLIC_API_BASE_URL |
| "Error al procesar" | Servidor no disponible | Verifica que FastAPI está corriendo |
| No hay resultados SpO2 | Array vacío de SpO2 | Pasa valores válidos de SpO2 |

## 📝 Guía Paso a Paso para MonitorActiveScreen

Si quieres agregar predicción a `MonitorActiveScreen.tsx`:

1. **Importa el hook**:
   ```tsx
   import { useApneaDetection } from '../hooks/useApneaDetection';
   import ApneaResultCard from '../components/ApneaResultCard';
   ```

2. **Inicializa en el componente**:
   ```tsx
   const apnea = useApneaDetection({
     modo: monitoringMode === 'cell_oximeter' ? 'seguimiento' : 'screening',
   });
   ```

3. **Mantén un array de SpO2**:
   ```tsx
   const [spo2Readings, setSpo2Readings] = useState([]);

   // Cuando recibas lectura del oxímetro:
   useEffect(() => {
     // Simular o recibir del Bluetooth
     setSpo2Readings(prev => [...prev, 95 + Math.random() * 5 - 2.5]);
   }, []);
   ```

4. **Agrega análisis automático**:
   ```tsx
   useEffect(() => {
     let analysisInterval = null;

     const performAnalysis = async () => {
       try {
         const recentSpo2 = spo2Readings.slice(-30) || [95, 94, 93, 91];
         const result = await apnea.stopAndPredict(recentSpo2);

         // Manejar resultado
         if (result.nivel === 'CRITICO') {
           triggerSevereApneaAlert(...);
         }

         // Reiniciar grabación
         await apnea.startRecording();
       } catch (err) {
         console.error('Error:', err);
       }
     };

     // Iniciar primer análisis
     apnea.startRecording();
     analysisInterval = setInterval(performAnalysis, 30000);

     return () => clearInterval(analysisInterval);
   }, [apnea, spo2Readings]);
   ```

5. **Muestra resultados**:
   ```tsx
   <ApneaResultCard result={apnea.result} />
   ```

## 🎨 Personalización

### Cambiar colores de nivel

En `ApneaResultCard.tsx`, modifica `LEVEL_STYLES`:

```tsx
const LEVEL_STYLES = {
  NORMAL: {
    backgroundColor: '#ECFDF5',    // Tu color verde
    borderColor: '#10B981',
    badgeColor: '#10B981',
    textColor: '#047857',
  },
  // ... etc
};
```

### Cambiar duración de grabación

En `useApneaDetection.ts`, modifica:

```typescript
const SEGMENT_DURATION_MS = 30000; // Cambiar a otro valor (en ms)
```

## 📚 Recursos Adicionales

- Endpoint backend: `/api/sleep/v3/predict`
- Modelos disponibles: `v3_universal_dual_mode`
- Modos clínicos: `screening` (general), `seguimiento` (diagnosticados)
- Perfiles: `general`, `matias`

## ✅ Checklist de Integración

- [ ] Servidor FastAPI corriendo en http://localhost:8000 (o tu IP)
- [ ] Variable de entorno `EXPO_PUBLIC_API_BASE_URL` configurada
- [ ] Permisos de micrófono en Info.plist / AndroidManifest.xml
- [ ] Hook `useApneaDetection` importado en tu pantalla
- [ ] Componente `ApneaResultCard` disponible
- [ ] Valores de SpO2 disponibles (real o simulados)
- [ ] Probado en dispositivo físico o emulador
- [ ] Errores capturados y manejados

---

**Versión**: 1.0.0
**Última actualización**: Abril 26, 2026
**Estado**: ✅ Implementado y testeado

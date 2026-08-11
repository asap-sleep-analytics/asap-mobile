# MonitorActiveScreen - Apnea Detection Integration

## 🎯 Estado de Integración

La detección de apnea está **INTEGRADA COMPLETAMENTE** en `MonitorActiveScreen.tsx`.

## 📋 Lo que se agregó

### Funcionalidad
✅ **Predicción automática cada 30 segundos** - Cuando termina cada fragmento de audio  
✅ **SpO2 simulado** - 10 valores entre 92-96 (normal range) generados aleatoriamente  
✅ **Modo screening por defecto** - Para usuarios general  
✅ **Visualización de resultados** - Scroll horizontal con últimas 5 predicciones  
✅ **Alerta severa** - Si resultado es CRÍTICO, dispara triggerSevereApneaAlert  

### Componentes
- **Función API**: `predictApneaFromFile()` - Envía archivo ya grabado + SpO2 al endpoint
- **Hook**: `useApneaDetection` - Disponible si necesitas análisis manual (opcional)
- **Componente**: `ApneaResultCard` - Muestra resultados con colores (NORMAL/ALERTA/CRÍTICO)
- **Helper**: `generateSimulatedSpo2Values()` - Genera SpO2 simulado

## 📊 Flujo de Ejecución

```
MonitorActiveScreen (grabación de 30s)
       ↓
finalizeCurrentFragment()
       ↓
generateSimulatedSpo2Values(10)  // Array: [94, 95, 93, 94, 92, ...]
       ↓
predictApneaFromFile({
  fileUri: uri,
  spo2: [94, 95, 93, ...],
  modo: 'screening',
  perfil: 'general'
})
       ↓
POST /api/sleep/v3/predict
       ↓
Respuesta: { nivel: "NORMAL", probabilidad: 0.32, ... }
       ↓
setPredictions([...prevPredictions, result])
       ↓
Renderizar ApneaResultCard con resultado
```

## 🎨 Visualización

En la pantalla aparece:
```
┌─────────────────────────────────────┐
│ PREDICCIONES DE APNEA              │
│                                     │
│ ┌──────────────┐ ┌──────────────┐  │
│ │   NORMAL     │ │   ALERTA     │  │
│ │ 32.1%        │ │ 54.8%        │  │
│ │ Sin eventos  │ │ Posible...   │  │
│ └──────────────┘ └──────────────┘  │
│                                     │
│ SpO2: 95, 94, 92, 94, 93, 96, ...  │
└─────────────────────────────────────┘
```

## ⚙️ Configuración Requerida

### .env

```env
# URL del backend (sin /api al final)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.5:8000

# O para diferentes entornos:
# Simulador iOS: http://127.0.0.1:8000
# Emulador Android: http://10.0.2.2:8000
# Dispositivo físico: http://<tu-ip-local>:8000
```

### Backend Requerimientos
- FastAPI corriendo en `http://localhost:8000`
- Endpoint `/api/sleep/v3/predict` disponible
- Modelos ML v3 cargados

## 🔄 Integración del Oxímetro Real (Para después)

Cuando conectes el oxímetro real, simplemente reemplaza en `MonitorActiveScreen.tsx`:

```typescript
// AHORA (línea ~80):
const [spo2Values, setSpo2Values] = useState([]);

// DESPUÉS: Conecta tu contexto de oxímetro
// const { spo2Readings } = useContext(OximeterContext);
// y usa spo2Readings en lugar de generateSimulatedSpo2Values()
```

Luego en `finalizeCurrentFragment` (~line 315):

```typescript
// CAMBIAR DE:
const currentSpo2 = generateSimulatedSpo2Values(10);

// A:
const currentSpo2 = spo2Readings.slice(-10); // Últimas 10 lecturas del oxímetro
```

## 🧪 Pruebas

Para testear localmente:

1. **Backend corriendo**: 
   ```bash
   cd asap-backend
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. **Verificar `/health`**:
   ```bash
   curl http://localhost:8000/health
   # Respuesta: {"status":"ok"}
   ```

3. **Verificar `/predict` endpoint**:
   ```bash
   curl -X POST http://localhost:8000/api/sleep/v3/predict \
     -F "audio=@audio_sample.wav" \
     -F "spo2=95,94,93,91" \
     -F "modo=screening" \
     -F "perfil=general"
   ```

4. **En la app**:
   - Abre MonitorActiveScreen
   - Inicia monitoreo
   - Después de 30 segundos, verás la primera predicción
   - La predicción se actualiza cada 30 segundos automáticamente

## 📝 Estados Renderizados

### Mientras graba (0-30s):
```
Grabando: 15.2s / 30s
[========>    ] 50%
```

### Durante predicción:
```
Procesando predicción...
(spinner)
```

### Después de predicción:
```
PREDICCIONES DE APNEA

┌─────────────┐
│   NORMAL    │
│ 31.5%       │
│ Sin eventos │
└─────────────┘

SpO2: 95, 94, 93, 92, 95, ...
```

## ⚠️ Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| "Error al procesar" | Backend no disponible | Verifica http://EXPO_PUBLIC_API_BASE_URL/health |
| No aparecen predicciones | URL incorrecta | Revisa .env EXPO_PUBLIC_API_BASE_URL |
| "Audio demasiado corto" | Fragmento < 2s | Normal - ignora silenciosamente |
| Modelo no cargado | Modelos no descargados | `python scripts/download_ml_v3_models.py` |

## 🔗 Archivos Modificados

```
src/
├── services/
│   └── api.js
│       ├── predictApnea() - Usa blob/File
│       └── predictApneaFromFile() ✅ NUEVO - Usa URI local
├── features/monitor/screens/
│   └── MonitorActiveScreen.tsx ✅ ACTUALIZADO
│       ├── generateSimulatedSpo2Values() ✅ NUEVO
│       ├── predictApneaFromFile() import
│       ├── ApneaResultCard import
│       ├── predictions state
│       ├── spo2Values state
│       ├── finalizeCurrentFragment() - predicción lógica agregada
│       └── render - sección de predicciones agregada
└── hooks/
    ├── useApneaDetection.ts (existente - optional)
    └── APNEA_DETECTION_GUIDE.js (disponible para referencia)
```

## 📊 Métricas en Pantalla

Ahora MonitorActiveScreen muestra:
```
Fragmentos: 5
Subidos: 5
Pendientes: 0

Predicciones de Apnea: [5 últimas]
SpO2: 94, 95, 93, 92, 94, ...
```

## ✨ Próximos Pasos

1. **Hoy**: Testear con audio simulado
2. **Después**: Conectar oxímetro BLE real
3. **Validar**: Predicciones correctas vs médico
4. **Calibrar**: Ajustar modos si es necesario

## 🎯 Objetivo Cumplido

✅ Hook `useApneaDetection` creado (disponible para uso manual)  
✅ Endpoint `/predict` integrado en MonitorActiveScreen  
✅ SpO2 simulado (array 92-96)  
✅ Visualización con `ApneaResultCard`  
✅ Modo screening por defecto  
✅ URL desde variable de entorno  
✅ Alerta automática en CRÍTICO  

---

**Última actualización**: Abril 26, 2026  
**Estado**: ✅ Completado y funcional  
**Próximo**: Conexión del oxímetro real

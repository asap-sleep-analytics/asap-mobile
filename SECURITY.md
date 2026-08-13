# Notas de seguridad

Estado de dependencias del proyecto móvil (asap-mobile).

## Resumen

- SDK de Expo: **57** (`expo@^57.0.12`, `react-native@0.86.2`, `react@19.2.3`)
- `npm audit` (11 ago 2026): **23 vulnerabilidades** — 8 moderadas, 15 altas, 0 críticas.
- Se aplicó `npm audit fix` (sin `--force`): pasó de 25 → 23.
- `expo-doctor`: **20/20 checks passed** (11 ago 2026).
- Proyecto en **CNG (Continuous Native Generation)**: `android/` y `ios/` están en `.gitignore`
  y se generan con `expo prebuild` (fuente de verdad: `app.json`). Se eliminó el `android/`
  commiteado; `expo-system-ui` se instaló para soportar `userInterfaceStyle`.

## Vulnerabilidades aceptadas (sin fix no-rompedor)

Las 23 restantes derivan de solo **3 paquetes raíz** en el árbol, todas transitivas de
tooling de build o de una librería de gráficos client-side. Ninguna es alcanzable por
input externo en runtime de la app. Forzar su arreglo desharía el upgrade a SDK 57.

| Paquete | Severidad | Advisories | Consecuencia si se fuerza el fix |
|---|---|---|---|
| `image-size` | alta | ReDoS en el parser (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) | `npm audit fix --force` instalaría `react-native@0.72.17` (breaking) |
| `uuid` (<11.1.1) | moderada | Missing buffer bounds check en v3/v5/v6 (GHSA-w5hq-g745-h8pq) | `--force` instalaría `expo@53.0.27` (breaking) |
| `d3-color` (1.x-3.0.1) | alta | ReDoS al parsear colores (GHSA-36jr-mh4h-2g58) | `npm audit fix` no la resuelve: requiere subir `d3-interpolate` a un major que rompe `react-native-wagmi-charts` |

Cadena de dependencia:

- `image-size` ← `metro` (bundler, solo tiempo de build en la máquina de desarrollo)
- `uuid` ← `xcode` ← `@expo/config-plugins` (tooling de build/iOS)
- `d3-color` ← `d3-interpolate` ← `d3-scale` ← `react-native-wagmi-charts`

Justificación de aceptación:

- **`image-size`**: solo procesa imágenes locales al compilar; nunca recibe input remoto.
- **`uuid`**: solo genera UUIDs en tiempo de build del paquete iOS.
- **`d3-color`**: `react-native-wagmi-charts` parsea colores definidos por la propia app,
  no datos provenientes de terceros.

## Comando de referencia

```bash
npm audit          # inspeccionar estado actual
npm audit fix      # fixes no-rompedores (ya aplicados)
```

No ejecutar `npm audit fix --force`: degrada `expo`/`react-native` a versiones incompatibles
con el resto del proyecto.
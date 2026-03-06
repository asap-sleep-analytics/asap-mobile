# ASAP Mobile

React Native + Expo SDK 50 application for the A.S.A.P. ecosystem.

## Responsibilities

- Registro y login del usuario final contra backend.
- Monitoreo de sesion de sueno (iniciar/finalizar) y calibracion de ruido.
- Consulta de dashboard con KPIs (`sleep_score`, eventos, continuidad).
- Soporte del endpoint historico `POST /analyze` para pruebas de metadata.

## Stack

- Expo SDK 50
- React Native
- React Navigation (Stack)
- Axios for API communication

## Environment

Copy `.env.example` to `.env` and adjust value as needed:

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
```

Notes:
- Android emulator normally requires `http://10.0.2.2:8001` instead of `127.0.0.1`.
- Physical devices must point to your LAN IP (example: `http://192.168.1.15:8001`).

## Connected Endpoints

- `POST /api/auth/registro`
- `POST /api/auth/login`
- `GET /api/auth/perfil`
- `GET /api/dashboard/resumen`
- `POST /api/sleep/calibracion`
- `POST /api/sleep/sesiones/iniciar`
- `POST /api/sleep/sesiones/{session_id}/finalizar`
- `GET /api/sleep/sesiones`

## Development

```bash
npm install
npx expo start
```

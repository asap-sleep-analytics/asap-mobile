import { palette } from '../theme/tokens';

export type ApneaRiskLevel = 'SIN_DATOS' | 'NORMAL' | 'BAJO' | 'MODERADO' | 'ALTO' | 'CRITICO';

export interface RiskVisual {
  level: ApneaRiskLevel;
  label: string;
  color: string;
  softColor: string;
  interpretation: string;
  nextStep: string;
}

export function riskFromApneaEvents(apneaCount: number | null | undefined): RiskVisual {
  const count = Number(apneaCount) || 0;

  if (count === 0) {
    return {
      level: 'NORMAL',
      label: 'Sin eventos',
      color: palette.success,
      softColor: palette.successSoft,
      interpretation: 'No se registraron apneas en la última noche.',
      nextStep: 'Por ahora no necesitas consulta. Sigue monitoreando con frecuencia.',
    };
  }
  if (count <= 2) {
    return {
      level: 'BAJO',
      label: 'Riesgo bajo',
      color: palette.success,
      softColor: palette.successSoft,
      interpretation: `Se registraron ${count} apneas. Eventos ocasionales y sin patrón de riesgo.`,
      nextStep: 'Mantén el monitoreo: completa también un registro de horas de sueño.',
    };
  }
  if (count <= 5) {
    return {
      level: 'MODERADO',
      label: 'Riesgo moderado',
      color: palette.warning,
      softColor: palette.warningSoft,
      interpretation: `Se registraron ${count} apneas. Hay un patrón que conviene vigilar.`,
      nextStep: 'Prueba dormir de lado y evita alcohol antes de acostarte. Vuelve a medir mañana.',
    };
  }
  if (count <= 9) {
    return {
      level: 'ALTO',
      label: 'Riesgo alto',
      color: palette.danger,
      softColor: palette.dangerSoft,
      interpretation: `Se registraron ${count} apneas. El patrón respiratorio requiere atención.`,
      nextStep: 'Consulta a un especialista del sueño y comparte esta información con tu médico.',
    };
  }
  return {
    level: 'CRITICO',
    label: 'Riesgo crítico',
    color: palette.danger,
    softColor: palette.dangerSoft,
    interpretation: `Se registraron ${count} apneas. Nivel de alerta severo.`,
    nextStep: 'Busca atención médica lo antes posible. Activa las alertas de emergencia si aún no lo hiciste.',
  };
}

export function riskFromPredictionNivel(nivel: string | null | undefined): RiskVisual {
  const value = String(nivel || '').toUpperCase();

  if (value === 'CRITICO') {
    return {
      level: 'CRITICO',
      label: 'Riesgo crítico',
      color: palette.danger,
      softColor: palette.dangerSoft,
      interpretation: 'Evento respiratorio severo detectado en el fragmento.',
      nextStep: 'Protocolo de emergencia activado. Revisa el estado de la persona y a sus contactos.',
    };
  }
  if (value === 'ALERTA') {
    return {
      level: 'ALTO',
      label: 'Riesgo alto',
      color: palette.danger,
      softColor: palette.dangerSoft,
      interpretation: 'El modelo marcó un evento de apnea probable en el fragmento.',
      nextStep: 'Mantén la posición de lado y verifica que el monitoreo siga activo.',
    };
  }
  if (value === 'NORMAL') {
    return {
      level: 'NORMAL',
      label: 'Respiración normal',
      color: palette.success,
      softColor: palette.successSoft,
      interpretation: 'No se detectó apnea en el último fragmento.',
      nextStep: 'Sigue durmiendo con tranquilidad.',
    };
  }
  return {
    level: 'SIN_DATOS',
    label: 'Analizando...',
    color: palette.textMuted,
    softColor: palette.panelStrong,
    interpretation: 'El modelo aún no devuelve un resultado para este fragmento.',
    nextStep: 'Espera unos segundos para el siguiente análisis.',
  };
}
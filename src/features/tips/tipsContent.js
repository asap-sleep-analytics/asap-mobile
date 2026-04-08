export const TIPS_MODULES = [
  {
    id: 'rutina-nocturna',
    title: 'Rutina nocturna',
    subtitle: 'Prepara cuerpo y mente antes de dormir',
    accent: '#9FB0FF',
    description:
      'Una rutina consistente ayuda a conciliar el sueño con menor ansiedad y mejora la continuidad nocturna.',
    sections: [
      {
        title: 'Qué hacer 90 minutos antes',
        bullets: [
          'Baja la intensidad de luz de pantallas.',
          'Evita comidas pesadas y cafeína nocturna.',
          'Prepara la habitación: fresca, oscura y silenciosa.',
        ],
      },
      {
        title: 'Ritual breve recomendado',
        bullets: [
          '5 minutos de respiración lenta.',
          '10 minutos de lectura ligera o estiramiento suave.',
          'Apagar notificaciones hasta la mañana siguiente.',
        ],
      },
    ],
    checklist: [
      'Apagué pantallas 60 minutos antes',
      'Preparé habitación oscura y fresca',
      'Evité cafeína en la noche',
    ],
    resources: [
      {
        label: 'Ministerio de Salud de Colombia',
        url: 'https://www.minsalud.gov.co',
      },
      {
        label: 'Instituto Nacional de Salud (Colombia)',
        url: 'https://www.ins.gov.co',
      },
    ],
  },
  {
    id: 'apnea-alertas',
    title: 'Apnea y señales de alerta',
    subtitle: 'Cuándo consultar y qué vigilar',
    accent: '#FFB870',
    description:
      'Reconocer señales tempranas permite buscar evaluación profesional antes de que los síntomas se agraven.',
    sections: [
      {
        title: 'Síntomas frecuentes',
        bullets: [
          'Ronquido intenso habitual.',
          'Pausas respiratorias observadas por otra persona.',
          'Somnolencia diurna y cefalea matutina.',
        ],
      },
      {
        title: 'Cuándo consultar pronto',
        bullets: [
          'Si te duermes con facilidad durante el día.',
          'Si hay hipertensión difícil de controlar.',
          'Si hay despertares con sensación de ahogo.',
        ],
      },
    ],
    checklist: ['Reconocí mis síntomas principales', 'Hablé con mi familia sobre pausas respiratorias', 'Planifiqué consulta médica'],
    resources: [
      {
        label: 'Asociación Colombiana de Neumología y Cirugía de Tórax',
        url: 'https://www.asoneumocito.org',
      },
      {
        label: 'Cuenta de Alto Costo (Colombia)',
        url: 'https://cuentadealtocosto.org',
      },
    ],
  },
  {
    id: 'habitos-colombia',
    title: 'Hábitos saludables en contexto colombiano',
    subtitle: 'Sugerencias aterrizadas a rutina local',
    accent: '#78E2C0',
    description:
      'Pequeños cambios sostenidos son más efectivos que cambios extremos que no se pueden mantener.',
    sections: [
      {
        title: 'Comida y horarios',
        bullets: [
          'Evita cenas muy copiosas después de las 9 p.m.',
          'Si cenas tarde, reduce fritos y ultraprocesados.',
          'Hidrátate durante el día para no tomar tanto líquido de noche.',
        ],
      },
      {
        title: 'Entorno y ruido',
        bullets: [
          'Usa ruido blanco si vives en zona con tráfico nocturno.',
          'Ajusta cortinas para reducir luz de calle.',
          'Mantén una hora de despertar estable incluso en fin de semana.',
        ],
      },
    ],
    checklist: ['Cené más liviano', 'Mantuve hora de despertar constante', 'Reduje ruido y luz en habitación'],
    resources: [
      {
        label: 'Portal GOV.CO Salud',
        url: 'https://www.gov.co/salud-y-proteccion-social',
      },
      {
        label: 'EPS SURA - hábitos de sueño',
        url: 'https://www.epssura.com',
      },
    ],
  },
];

export function getTipsModuleById(moduleId) {
  return TIPS_MODULES.find((item) => item.id === moduleId) || null;
}

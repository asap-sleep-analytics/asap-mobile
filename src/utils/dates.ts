function parseSafeDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDateTime(value: string | null | undefined): string {
  const parsed = parseSafeDate(value);
  if (parsed === null) {
    return '--';
  }
  return new Date(parsed).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(value: string | null | undefined): string {
  const parsed = parseSafeDate(value);
  if (parsed === null) {
    return '--';
  }
  return new Date(parsed).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function formatDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  const start = parseSafeDate(startTime);
  const end = parseSafeDate(endTime);
  if (start === null || end === null || end <= start) {
    return '--';
  }

  const totalMinutes = Math.round((end - start) / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours} h ${mins} min`;
}

export function toIsoDate(value: string | null | undefined): string {
  const parsed = parseSafeDate(value);
  if (parsed === null) {
    return '--';
  }
  return new Date(parsed).toISOString().slice(0, 16).replace('T', ' ');
}

export function toYearMonthDay(value: string | null | undefined): string {
  const parsed = parseSafeDate(value);
  if (parsed === null) {
    return '--';
  }
  return new Date(parsed).toISOString().slice(0, 10);
}
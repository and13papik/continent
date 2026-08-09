export interface KyivShift {
  label: string;
  start: string; // ISO 8601 UTC
  end: string;   // ISO 8601 UTC
}

export interface ShiftConfig {
  index: 1 | 2 | 3 | 4;
  label: string;
  startHour: number;
  endHour: number;
}

export const SHIFTS_CONFIG: ShiftConfig[] = [
  { index: 1, label: "02:00–08:00", startHour: 2, endHour: 8 },
  { index: 2, label: "08:00–14:00", startHour: 8, endHour: 14 },
  { index: 3, label: "14:00–20:00", startHour: 14, endHour: 20 },
  { index: 4, label: "20:00–02:00", startHour: 20, endHour: 2 }
];

export function kyivWallTimeToUTC(dateStr: string, hour: number): string {
  const paddedHour = String(hour).padStart(2, '0');
  const naiveUtc = new Date(`${dateStr}T${paddedHour}:00:00.000Z`);

  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });
  const kyivHourAtNaive = parseInt(hourFmt.format(naiveUtc), 10) || 0;

  let offsetHours = kyivHourAtNaive - hour;
  if (offsetHours > 12) offsetHours -= 24;
  if (offsetHours < -12) offsetHours += 24;

  const targetMs = naiveUtc.getTime() - (offsetHours * 3600000);
  return new Date(targetMs).toISOString();
}

export function getCurrentKyivShiftIndex(): 1 | 2 | 3 | 4 {
  const now = new Date();
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });
  const kyivHour = parseInt(hourFormatter.format(now), 10) || 0;

  if (kyivHour >= 2 && kyivHour < 8) return 1;
  if (kyivHour >= 8 && kyivHour < 14) return 2;
  if (kyivHour >= 14 && kyivHour < 20) return 3;
  return 4;
}

export function getKyivDateStr(offsetDays: number = 0): string {
  const targetDate = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return dateFormatter.format(targetDate);
}

export function getShiftRangeForDate(
  dateStr: string,
  shiftIndex: 1 | 2 | 3 | 4
): KyivShift {
  const config = SHIFTS_CONFIG.find(s => s.index === shiftIndex) || SHIFTS_CONFIG[0];
  if (shiftIndex !== 4) {
    const start = kyivWallTimeToUTC(dateStr, config.startHour);
    const end = kyivWallTimeToUTC(dateStr, config.endHour);
    return { label: config.label, start, end };
  } else {
    // shift 4 goes from dateStr 20:00 to next day 02:00
    const [y, m, d] = dateStr.split('-').map(Number);
    const nextDt = new Date(Date.UTC(y, m - 1, d + 1));
    const nextYear = nextDt.getUTCFullYear();
    const nextMonth = String(nextDt.getUTCMonth() + 1).padStart(2, '0');
    const nextDay = String(nextDt.getUTCDate()).padStart(2, '0');
    const nextDateStr = `${nextYear}-${nextMonth}-${nextDay}`;

    const start = kyivWallTimeToUTC(dateStr, 20);
    const end = kyivWallTimeToUTC(nextDateStr, 2);
    return { label: config.label, start, end };
  }
}

export function getShiftRangeForDay(
  day: 'today' | 'yesterday',
  shiftIndex: 1 | 2 | 3 | 4
): KyivShift {
  const baseOffset = day === 'today' ? 0 : -1;
  const baseDate = getKyivDateStr(baseOffset);
  return getShiftRangeForDate(baseDate, shiftIndex);
}

export function getWeekRange(): KyivShift {
  const todayKyivStr = getKyivDateStr(0);
  const utcDate = new Date(`${todayKyivStr}T00:00:00Z`);
  const weekday = utcDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  const mondayMs = utcDate.getTime() - daysSinceMonday * 24 * 3600 * 1000;
  const mondayDate = new Date(mondayMs);
  const year = mondayDate.getUTCFullYear();
  const month = String(mondayDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(mondayDate.getUTCDate()).padStart(2, '0');
  const mondayDateStr = `${year}-${month}-${day}`;

  const start = kyivWallTimeToUTC(mondayDateStr, 0);
  const end = new Date().toISOString();

  return { label: "Текущая неделя", start, end };
}

export function getMonthRange(): KyivShift {
  const todayKyivStr = getKyivDateStr(0);
  const monthStartDateStr = `${todayKyivStr.slice(0, 7)}-01`;

  const start = kyivWallTimeToUTC(monthStartDateStr, 0);
  const end = new Date().toISOString();

  return { label: "Текущий месяц", start, end };
}

export function getCurrentKyivShift(): KyivShift {
  const currentIndex = getCurrentKyivShiftIndex();
  const now = new Date();

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });
  const kyivHour = parseInt(hourFormatter.format(now), 10) || 0;

  // If hour is 00:00-01:59, we are in shift 4 which started yesterday at 20:00
  if (kyivHour < 2) {
    const prevDayStr = getKyivDateStr(-1);
    const todayStr = getKyivDateStr(0);
    const start = kyivWallTimeToUTC(prevDayStr, 20);
    const end = kyivWallTimeToUTC(todayStr, 2);
    return { label: "20:00–02:00", start, end };
  }

  return getShiftRangeForDay('today', currentIndex);
}

export function getOperationalDayRange(day: 'today' | 'yesterday' = 'today'): { start: string; end: string; label: string } {
  const now = new Date();
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });
  const kyivHour = parseInt(hourFormatter.format(now), 10) || 0;

  // If hour >= 2, today's operational day anchor is today (0). If hour < 2, we are in yesterday's operational day (-1).
  const anchorOffset = kyivHour >= 2 ? 0 : -1;
  const baseOffset = day === 'today' ? anchorOffset : anchorOffset - 1;

  const baseDateStr = getKyivDateStr(baseOffset);
  const nextDateStr = getKyivDateStr(baseOffset + 1);

  const start = kyivWallTimeToUTC(baseDateStr, 2);
  const end = kyivWallTimeToUTC(nextDateStr, 2);
  const label = day === 'today' ? 'Сегодня' : 'Вчера';

  return { start, end, label };
}

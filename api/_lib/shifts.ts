export interface KyivShift {
  label: string;
  start: string; // ISO 8601 UTC
  end: string;   // ISO 8601 UTC
}

function kyivWallTimeToUTC(dateStr: string, hour: number): string {
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

export function getCurrentKyivShift(): KyivShift {
  const now = new Date();

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });

  const kyivDateStr = dateFormatter.format(now); // "YYYY-MM-DD"
  const kyivHour = parseInt(hourFormatter.format(now), 10) || 0;

  const prevDayDateStr = dateFormatter.format(new Date(now.getTime() - 24 * 3600 * 1000));
  const nextDayDateStr = dateFormatter.format(new Date(now.getTime() + 24 * 3600 * 1000));

  let label = "";
  let startDateStr = "";
  let startHour = 0;
  let endDateStr = "";
  let endHour = 0;

  if (kyivHour >= 2 && kyivHour < 8) {
    label = "02:00–08:00";
    startDateStr = kyivDateStr;
    startHour = 2;
    endDateStr = kyivDateStr;
    endHour = 8;
  } else if (kyivHour >= 8 && kyivHour < 14) {
    label = "08:00–14:00";
    startDateStr = kyivDateStr;
    startHour = 8;
    endDateStr = kyivDateStr;
    endHour = 14;
  } else if (kyivHour >= 14 && kyivHour < 20) {
    label = "14:00–20:00";
    startDateStr = kyivDateStr;
    startHour = 14;
    endDateStr = kyivDateStr;
    endHour = 20;
  } else if (kyivHour >= 20) {
    label = "20:00–02:00";
    startDateStr = kyivDateStr;
    startHour = 20;
    endDateStr = nextDayDateStr;
    endHour = 2;
  } else {
    // kyivHour < 2 (00:00 - 01:59)
    label = "20:00–02:00";
    startDateStr = prevDayDateStr;
    startHour = 20;
    endDateStr = kyivDateStr;
    endHour = 2;
  }

  const start = kyivWallTimeToUTC(startDateStr, startHour);
  const end = kyivWallTimeToUTC(endDateStr, endHour);

  return { label, start, end };
}

const MINUTE_IN_MS = 60_000;

function asNonNegativeInteger(value) {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function createLocalDateTime(dateValue, timeValue) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue || "");
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (hour > 23 || minute > 59) return null;
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) {
    return null;
  }
  return result;
}

export function durationToMinutes(hours, minutes) {
  const parsedHours = asNonNegativeInteger(hours);
  const parsedMinutes = asNonNegativeInteger(minutes);
  if (parsedHours === null || parsedMinutes === null || parsedMinutes > 59)
    return null;
  const total = parsedHours * 60 + parsedMinutes;
  return Number.isSafeInteger(total) ? total : null;
}

export function addMinutes(start, minutes) {
  const parsedMinutes = asNonNegativeInteger(minutes);
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || parsedMinutes === null)
    return null;
  const result = new Date(start.getTime() + parsedMinutes * MINUTE_IN_MS);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function splitDuration(totalMinutes) {
  const parsed = asNonNegativeInteger(totalMinutes);
  if (parsed === null) return null;
  return {
    days: Math.floor(parsed / 1_440),
    hours: Math.floor((parsed % 1_440) / 60),
    minutes: parsed % 60,
  };
}

export function formatDurationCompact(totalMinutes) {
  const parts = splitDuration(totalMinutes);
  if (!parts) return "—";
  const totalHours = parts.days * 24 + parts.hours;
  if (!totalHours) return `${parts.minutes}min`;
  return parts.minutes ? `${totalHours}h${parts.minutes}min` : `${totalHours}h`;
}

export function formatDurationFriendly(totalMinutes) {
  const parts = splitDuration(totalMinutes);
  if (!parts) return "—";
  const labels = [];
  if (parts.days) labels.push(`${parts.days} ${parts.days === 1 ? "dia" : "dias"}`);
  if (parts.hours)
    labels.push(`${parts.hours} ${parts.hours === 1 ? "hora" : "horas"}`);
  if (parts.minutes || labels.length === 0)
    labels.push(`${parts.minutes} ${parts.minutes === 1 ? "minuto" : "minutos"}`);
  if (labels.length < 2) return labels[0];
  return `${labels.slice(0, -1).join(", ")} e ${labels.at(-1)}`;
}

export function calendarDayDifference(start, end) {
  if (
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endDay - startDay) / 86_400_000);
}

export function createAlternativeSchedule(
  baseDate,
  durationMinutes,
  startHours = [18, 20, 22, 0, 6, 8],
) {
  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return [];
  const parsedDuration = asNonNegativeInteger(durationMinutes);
  if (parsedDuration === null || parsedDuration <= 0) return [];

  return startHours.flatMap((hour) => {
    const parsedHour = asNonNegativeInteger(hour);
    if (parsedHour === null || parsedHour > 23) return [];
    const start = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      parsedHour,
      0,
      0,
      0,
    );
    const end = addMinutes(start, parsedDuration);
    return end
      ? [{ start, end, dayOffset: calendarDayDifference(start, end) }]
      : [];
  });
}

export function createPrintQueue(start, durationMinutes, quantity, pauseMinutes = 0) {
  const parsedDuration = asNonNegativeInteger(durationMinutes);
  const parsedQuantity = asNonNegativeInteger(quantity);
  const parsedPause = asNonNegativeInteger(pauseMinutes);
  if (
    !(start instanceof Date) ||
    Number.isNaN(start.getTime()) ||
    parsedDuration === null ||
    parsedDuration <= 0 ||
    parsedQuantity === null ||
    parsedQuantity <= 0 ||
    parsedPause === null
  ) {
    return null;
  }

  const items = [];
  let itemStart = new Date(start);
  for (let index = 0; index < parsedQuantity; index += 1) {
    const end = addMinutes(itemStart, parsedDuration);
    if (!end) return null;
    items.push({ number: index + 1, start: itemStart, end });
    if (index < parsedQuantity - 1) {
      itemStart = addMinutes(end, parsedPause);
      if (!itemStart) return null;
    }
  }

  const totalMinutes =
    parsedDuration * parsedQuantity + parsedPause * Math.max(0, parsedQuantity - 1);
  return {
    items,
    totalMinutes,
    completion: items.at(-1).end,
  };
}

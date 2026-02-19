const LOCALE = "en-US";
const DAY_FORMATTERS = new Map();
const MINUTE_FORMATTERS = new Map();

function toDate(value) {
  return typeof value === "string" ? new Date(value) : value;
}

function getDayFormatter(timeZone) {
  if (DAY_FORMATTERS.has(timeZone)) return DAY_FORMATTERS.get(timeZone);
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    DAY_FORMATTERS.set(timeZone, formatter);
    return formatter;
  } catch {
    DAY_FORMATTERS.set(timeZone, null);
    return null;
  }
}

function getMinuteFormatter(timeZone) {
  if (MINUTE_FORMATTERS.has(timeZone)) return MINUTE_FORMATTERS.get(timeZone);
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    MINUTE_FORMATTERS.set(timeZone, formatter);
    return formatter;
  } catch {
    MINUTE_FORMATTERS.set(timeZone, null);
    return null;
  }
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat(LOCALE, { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function eventDay(time, timeZone) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = getDayFormatter(timeZone);
  if (!formatter) return null;
  const parts = formatter.formatToParts(date);
  const lookup = {};
  for (const part of parts) lookup[part.type] = part.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function formatMinuteKey(time, timeZone) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = getMinuteFormatter(timeZone);
  if (!formatter) return null;
  const parts = formatter.formatToParts(date);
  const lookup = {};
  for (const part of parts) lookup[part.type] = part.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}`;
}

export function eventTimeTable(value, showTz, tz) {
  const date = toDate(value);
  return date.toLocaleTimeString(LOCALE, {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: showTz ? "short" : undefined,
  });
}

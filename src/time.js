const LOCALE = "en-US";
const DAY_FORMATTERS = new Map();
const MINUTE_FORMATTERS = new Map();

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

export function getEventTimestampSeconds(event) {
  if (event.beginTimestampSeconds != null) return event.beginTimestampSeconds;
  if (event.begin_timestamp?.seconds != null) return event.begin_timestamp.seconds;
  const ms = Date.parse(event.begin);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function getEventEndTimestampSeconds(event) {
  if (event.endTimestampSeconds != null) return event.endTimestampSeconds;
  if (event.end_timestamp?.seconds != null) return event.end_timestamp.seconds;
  const ms = Date.parse(event.end);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

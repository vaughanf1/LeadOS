import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { WorkingHours } from "./settings-defaults";

export const UK_TZ = "Europe/London";

export function nowInUK(d: Date = new Date()): Date {
  return toZonedTime(d, UK_TZ);
}

export function ukParts(d: Date = new Date()) {
  const zoned = toZonedTime(d, UK_TZ);
  return {
    dayOfWeek: zoned.getDay(),         // 0=Sun … 6=Sat
    hours: zoned.getHours(),
    minutes: zoned.getMinutes(),
    minutesSinceMidnight: zoned.getHours() * 60 + zoned.getMinutes(),
    dateISO: formatInTimeZone(d, UK_TZ, "yyyy-MM-dd"),
  };
}

export function parseHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) throw new Error(`Invalid HH:mm: ${hhmm}`);
  return h * 60 + m;
}

export function isWithinBusinessHours(
  hours: WorkingHours,
  d: Date = new Date()
): boolean {
  const { minutesSinceMidnight, dayOfWeek } = ukParts(d);
  // Mon-Fri only at business level. Weekend behaviour is handled per-advisor.
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return (
    minutesSinceMidnight >= parseHHmm(hours.startHHmm) &&
    minutesSinceMidnight < parseHHmm(hours.endHHmm)
  );
}

export function isWithinSchedule(
  schedule: { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean },
  d: Date = new Date()
): boolean {
  if (!schedule.enabled) return false;
  const { dayOfWeek, minutesSinceMidnight } = ukParts(d);
  if (schedule.dayOfWeek !== dayOfWeek) return false;
  return (
    minutesSinceMidnight >= parseHHmm(schedule.startTime) &&
    minutesSinceMidnight < parseHHmm(schedule.endTime)
  );
}

export function formatUK(d: Date | string, fmt = "yyyy-MM-dd HH:mm"): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return formatInTimeZone(date, UK_TZ, fmt);
}

import { describe, it, expect } from "vitest";
import { isWithinBusinessHours, parseHHmm, isWithinSchedule } from "@/lib/time";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const H = DEFAULT_SETTINGS["hours.working"];

describe("time helpers", () => {
  it("parseHHmm", () => {
    expect(parseHHmm("00:00")).toBe(0);
    expect(parseHHmm("09:00")).toBe(540);
    expect(parseHHmm("17:30")).toBe(17 * 60 + 30);
  });

  it("isWithinBusinessHours: weekday inside", () => {
    // Tue 11:00 UTC ≈ 11:00 London in winter
    expect(isWithinBusinessHours(H, new Date("2026-01-13T11:00:00Z"))).toBe(true);
  });

  it("isWithinBusinessHours: weekday after 5pm", () => {
    expect(isWithinBusinessHours(H, new Date("2026-01-13T22:00:00Z"))).toBe(false);
  });

  it("isWithinBusinessHours: Sunday", () => {
    expect(isWithinBusinessHours(H, new Date("2026-01-11T11:00:00Z"))).toBe(false);
  });

  it("isWithinSchedule: custom Mon-Thu 10:00-13:30 pattern", () => {
    const monday = new Date("2026-01-12T11:00:00Z");
    expect(
      isWithinSchedule(
        { dayOfWeek: 1, startTime: "10:00", endTime: "13:30", enabled: true },
        monday
      )
    ).toBe(true);
    expect(
      isWithinSchedule(
        { dayOfWeek: 1, startTime: "10:00", endTime: "13:30", enabled: true },
        new Date("2026-01-12T14:00:00Z")
      )
    ).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { CommandSchema, isDestructive } from "@/lib/ai/commands";

describe("CommandSchema", () => {
  it("accepts pause_advisor with end date", () => {
    const r = CommandSchema.safeParse({
      action: "pause_advisor",
      advisorName: "Kevin",
      pausedUntil: "2026-05-18",
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown action", () => {
    const r = CommandSchema.safeParse({ action: "make_coffee", advisorName: "Sarah" });
    expect(r.success).toBe(false);
  });

  it("accepts set_schedule with proper HH:mm and day ints", () => {
    const r = CommandSchema.safeParse({
      action: "set_schedule",
      advisorName: "Sonia",
      days: [1, 2, 3, 4],
      startTime: "10:00",
      endTime: "13:30",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed times", () => {
    const r = CommandSchema.safeParse({
      action: "set_schedule",
      advisorName: "Sonia",
      days: [1],
      startTime: "10am",
      endTime: "13:30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects out-of-range day", () => {
    const r = CommandSchema.safeParse({
      action: "set_schedule",
      advisorName: "Sonia",
      days: [9],
      startTime: "10:00",
      endTime: "13:30",
    });
    expect(r.success).toBe(false);
  });

  it("clamps daily cap range", () => {
    const r = CommandSchema.safeParse({
      action: "set_daily_cap",
      advisorName: "Sarah",
      dailyLeadCap: 99,
    });
    expect(r.success).toBe(false);
  });

  it("isDestructive correctly classifies queries vs mutations", () => {
    expect(
      isDestructive({ action: "query_today_assignments" } as const)
    ).toBe(false);
    expect(
      isDestructive({
        action: "pause_advisor",
        advisorName: "Kevin",
      } as const)
    ).toBe(true);
  });
});

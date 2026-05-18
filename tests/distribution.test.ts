import { describe, it, expect } from "vitest";
import { planDistribution, advisorEligibility, type AdvisorWithSchedule } from "@/lib/distribution";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const HOURS = DEFAULT_SETTINGS["hours.working"];

// A Tuesday at 11:00 UK ≈ 11:00 UTC in winter; this string is interpreted as UTC.
// To avoid DST flakiness in tests, we explicitly build a Date pointing at a
// Tuesday 11:00 Europe/London. We use a known winter Tuesday.
const TUE_11AM_UTC = new Date("2026-01-13T11:00:00Z"); // Tue 11:00 UTC == 11:00 GMT (winter)
const TUE_22_00_UTC = new Date("2026-01-13T22:00:00Z"); // After hours

function advisor(over: Partial<AdvisorWithSchedule>): AdvisorWithSchedule {
  const now = new Date();
  return {
    id: "a",
    name: "A",
    phone: null,
    email: null,
    group: "A",
    status: "ACTIVE",
    preferredDelivery: "BOTH",
    dailyLeadCap: 2,
    priority: 100,
    acceptsHigh: true,
    acceptsMid: true,
    acceptsLow: false,
    weekendEnabled: false,
    pausedUntil: null,
    notes: null,
    leadsReceivedToday: 0,
    countersResetAt: now,
    createdAt: now,
    updatedAt: now,
    schedules: [],
    ...over,
  } as AdvisorWithSchedule;
}

describe("advisorEligibility", () => {
  it("rejects paused advisor", () => {
    const a = advisor({ status: "PAUSED" });
    const r = advisorEligibility(a, "HIGH", HOURS, TUE_11AM_UTC);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/PAUSED/);
  });

  it("rejects when daily cap reached", () => {
    const a = advisor({ leadsReceivedToday: 2, dailyLeadCap: 2 });
    const r = advisorEligibility(a, "HIGH", HOURS, TUE_11AM_UTC);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/daily cap/);
  });

  it("rejects HIGH for advisors not accepting HIGH", () => {
    const a = advisor({ acceptsHigh: false });
    const r = advisorEligibility(a, "HIGH", HOURS, TUE_11AM_UTC);
    expect(r.eligible).toBe(false);
  });

  it("rejects outside business hours", () => {
    const a = advisor({});
    const r = advisorEligibility(a, "HIGH", HOURS, TUE_22_00_UTC);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/outside default business hours|outside custom hours|weekend/);
  });

  it("accepts inside business hours with capacity", () => {
    const a = advisor({});
    const r = advisorEligibility(a, "HIGH", HOURS, TUE_11AM_UTC);
    expect(r.eligible).toBe(true);
  });

  it("respects a custom schedule (Kevin/Sonia/Amy pattern)", () => {
    // Tue 11:00 — inside 10:00-13:30 window → eligible
    const a = advisor({
      schedules: [
        { id: "s", advisorId: "a", dayOfWeek: 2, startTime: "10:00", endTime: "13:30", enabled: true },
      ],
    });
    const inWindow = advisorEligibility(a, "HIGH", HOURS, TUE_11AM_UTC);
    expect(inWindow.eligible).toBe(true);

    // Tue 22:00 — outside custom window → not eligible (even though default hours would also exclude)
    const outOfWindow = advisorEligibility(a, "HIGH", HOURS, TUE_22_00_UTC);
    expect(outOfWindow.eligible).toBe(false);
  });
});

describe("planDistribution", () => {
  it("HIGH goes to Group A with lowest load", () => {
    const advisors = [
      advisor({ id: "a1", name: "Alice", group: "A", priority: 10, leadsReceivedToday: 1 }),
      advisor({ id: "a2", name: "Bob", group: "A", priority: 10, leadsReceivedToday: 0 }),
      advisor({ id: "b1", name: "Carl", group: "B", priority: 50, acceptsHigh: false }),
    ];
    const plan = planDistribution({
      lead: { qualityBand: "HIGH" },
      advisors,
      hours: HOURS,
      afterHoursMode: "CRAIG",
      now: TUE_11AM_UTC,
    });
    expect(plan.outcome).toBe("ASSIGN");
    expect(plan.targetGroup).toBe("A");
    expect(plan.advisorIds).toEqual(["a2"]);
  });

  it("HIGH falls back to Group B when Group A is exhausted", () => {
    const advisors = [
      advisor({ id: "a1", group: "A", leadsReceivedToday: 2, dailyLeadCap: 2 }),
      advisor({ id: "b1", name: "Betty", group: "B", priority: 30 }),
    ];
    const plan = planDistribution({
      lead: { qualityBand: "HIGH" },
      advisors,
      hours: HOURS,
      afterHoursMode: "CRAIG",
      now: TUE_11AM_UTC,
    });
    expect(plan.outcome).toBe("ASSIGN");
    expect(plan.targetGroup).toBe("B");
  });

  it("LOW goes to Group B / backend, never Group A", () => {
    const advisors = [
      advisor({ id: "a1", group: "A", acceptsLow: false }),
      advisor({ id: "b1", name: "Bee", group: "B", acceptsLow: true }),
    ];
    const plan = planDistribution({
      lead: { qualityBand: "LOW" },
      advisors,
      hours: HOURS,
      afterHoursMode: "CRAIG",
      now: TUE_11AM_UTC,
    });
    expect(plan.outcome).toBe("ASSIGN");
    expect(plan.targetGroup).toBe("B");
  });

  it("after-hours CRAIG → backend route", () => {
    const advisors = [
      advisor({ id: "a1", group: "A" }),
      advisor({
        id: "bk",
        name: "Craig",
        group: "BACKEND",
        priority: 99,
        weekendEnabled: true,
        acceptsHigh: true,
      }),
    ];
    const plan = planDistribution({
      lead: { qualityBand: "HIGH" },
      advisors,
      hours: HOURS,
      afterHoursMode: "CRAIG",
      now: TUE_22_00_UTC,
    });
    // Backend advisor without custom schedule + weekendEnabled is eligible only on weekends,
    // so during weekday evening they're not eligible via custom-availability path → AFTER_HOURS.
    expect(plan.outcome).toBe("AFTER_HOURS");
    expect(plan.advisorIds).toEqual(["bk"]);
  });

  it("after-hours HOLD → HOLD outcome", () => {
    const plan = planDistribution({
      lead: { qualityBand: "HIGH" },
      advisors: [advisor({ id: "a1" })],
      hours: HOURS,
      afterHoursMode: "HOLD",
      now: TUE_22_00_UTC,
    });
    expect(plan.outcome).toBe("HOLD");
  });

  it("after-hours but custom-scheduled advisor is available → assign", () => {
    // 22:00 Tue — advisor with a Tue 21:00-23:00 custom schedule should still get it.
    const advisors = [
      advisor({
        id: "night",
        name: "Night",
        group: "A",
        schedules: [
          {
            id: "s",
            advisorId: "night",
            dayOfWeek: 2,
            startTime: "21:00",
            endTime: "23:00",
            enabled: true,
          },
        ],
      }),
    ];
    const plan = planDistribution({
      lead: { qualityBand: "HIGH" },
      advisors,
      hours: HOURS,
      afterHoursMode: "HOLD",
      now: TUE_22_00_UTC,
    });
    expect(plan.outcome).toBe("ASSIGN");
    expect(plan.advisorIds).toEqual(["night"]);
  });

  it("priority breaks ties; load breaks priority ties", () => {
    const advisors = [
      advisor({ id: "p20", priority: 20, leadsReceivedToday: 0, name: "P20" }),
      advisor({ id: "p10a", priority: 10, leadsReceivedToday: 1, name: "P10a" }),
      advisor({ id: "p10b", priority: 10, leadsReceivedToday: 0, name: "P10b" }),
    ];
    const plan = planDistribution({
      lead: { qualityBand: "HIGH" },
      advisors,
      hours: HOURS,
      afterHoursMode: "CRAIG",
      now: TUE_11AM_UTC,
    });
    // p10b wins: lowest priority value AND lowest leads-today among the priority-10 pair.
    expect(plan.advisorIds).toEqual(["p10b"]);
  });
});

import type {
  Advisor,
  AdvisorGroup,
  AdvisorSchedule,
  Lead,
  QualityBand,
} from "@prisma/client";
import { isWithinBusinessHours, isWithinSchedule, parseHHmm, ukParts } from "./time";
import type { WorkingHours } from "./settings-defaults";

export type AdvisorWithSchedule = Advisor & { schedules: AdvisorSchedule[] };

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
};

/**
 * Decide whether an individual advisor is allowed to receive `band` right now.
 * Reasons returned in plain English — they feed straight into the decision log.
 */
export function advisorEligibility(
  adv: AdvisorWithSchedule,
  band: QualityBand,
  hours: WorkingHours,
  now: Date = new Date()
): EligibilityResult {
  if (adv.status !== "ACTIVE") return { eligible: false, reason: `status=${adv.status}` };
  if (adv.pausedUntil && adv.pausedUntil > now) {
    return { eligible: false, reason: `paused until ${adv.pausedUntil.toISOString()}` };
  }
  if (adv.leadsReceivedToday >= adv.dailyLeadCap) {
    return {
      eligible: false,
      reason: `daily cap reached (${adv.leadsReceivedToday}/${adv.dailyLeadCap})`,
    };
  }
  if (band === "HIGH" && !adv.acceptsHigh) {
    return { eligible: false, reason: "does not accept HIGH leads" };
  }
  if (band === "MID" && !adv.acceptsMid) {
    return { eligible: false, reason: "does not accept MID leads" };
  }
  if (band === "LOW" && !adv.acceptsLow) {
    return { eligible: false, reason: "does not accept LOW leads" };
  }

  // Schedule check: a custom schedule for today overrides default business hours.
  const { dayOfWeek } = ukParts(now);
  const todaysSchedule = adv.schedules.find((s) => s.dayOfWeek === dayOfWeek);

  if (todaysSchedule) {
    if (!isWithinSchedule(todaysSchedule, now)) {
      return {
        eligible: false,
        reason: `outside custom hours (${todaysSchedule.startTime}-${todaysSchedule.endTime})`,
      };
    }
  } else {
    // No custom schedule → fall back to default business hours.
    // Backend advisors can opt out of weekends entirely via weekendEnabled.
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend && !adv.weekendEnabled) {
      return { eligible: false, reason: "weekend (advisor not weekend-enabled)" };
    }
    // Enforce the working-hours time window on EVERY day, weekends included.
    // Without this, a weekend-enabled advisor with no custom schedule counts as
    // available 24/7 on Sat/Sun, so overnight weekend leads get delivered live
    // instead of being held for the 09:00 morning release. Weekday out-of-hours
    // leads were already excluded here; this extends the same guard to weekends.
    const { minutesSinceMidnight } = ukParts(now);
    const withinWindow =
      minutesSinceMidnight >= parseHHmm(hours.startHHmm) &&
      minutesSinceMidnight < parseHHmm(hours.endHHmm);
    if (!withinWindow) {
      return {
        eligible: false,
        reason: `outside working hours (${hours.startHHmm}-${hours.endHHmm})`,
      };
    }
  }

  return { eligible: true, reason: "eligible" };
}

export type Plan = {
  outcome: "ASSIGN" | "AFTER_HOURS" | "HOLD" | "UNASSIGNED";
  targetGroup?: AdvisorGroup;
  advisorIds: string[];
  trace: string[]; // human-readable decisions for the log
};

/**
 * Decide what to do with a lead. Pure function — no DB writes. Returns a plan
 * the caller persists.
 *
 * Caller is responsible for passing the right candidate set: all advisors with
 * schedules loaded, and the freshest `leadsReceivedToday` counter.
 */
export function planDistribution(opts: {
  lead: Pick<Lead, "qualityBand"> & { qualityBand: QualityBand };
  advisors: AdvisorWithSchedule[];
  hours: WorkingHours;
  afterHoursMode: "CRAIG" | "HOLD" | "AI_CHATBOT";
  now?: Date;
}): Plan {
  const { lead, advisors, hours, afterHoursMode, now = new Date() } = opts;
  const trace: string[] = [];
  const band = lead.qualityBand;
  const inHours = isWithinBusinessHours(hours, now);

  trace.push(
    `Time check: ${inHours ? "within" : "outside"} business hours ` +
      `(${hours.startHHmm}-${hours.endHHmm} ${hours.timeZone}).`
  );
  trace.push(`Lead quality: ${band}.`);

  if (!inHours) {
    // Backend/weekend advisors with custom schedules MAY still be eligible —
    // try them first. Anything that has a custom schedule for "now" is fair game.
    const customAvailable = advisors.filter((a) => {
      const elig = advisorEligibility(a, band, hours, now);
      return elig.eligible;
    });
    if (customAvailable.length) {
      trace.push(
        `Out-of-hours but ${customAvailable.length} advisor(s) with custom availability now.`
      );
      const picked = pickByPriorityAndLoad(customAvailable);
      trace.push(`Selected: ${picked.name} (priority=${picked.priority}, leadsToday=${picked.leadsReceivedToday}).`);
      return {
        outcome: "ASSIGN",
        targetGroup: picked.group,
        advisorIds: [picked.id],
        trace,
      };
    }

    if (afterHoursMode === "HOLD") {
      trace.push("After-hours mode = HOLD. Lead held until morning release.");
      return { outcome: "HOLD", advisorIds: [], trace };
    }
    if (afterHoursMode === "AI_CHATBOT") {
      trace.push("After-hours mode = AI_CHATBOT. Lead held for AI follow-up (feature flag).");
      return { outcome: "HOLD", advisorIds: [], trace };
    }

    // CRAIG / backend route
    const backend = advisors.filter((a) => a.group === "BACKEND" && a.status === "ACTIVE");
    if (backend.length) {
      const picked = pickByPriorityAndLoad(backend);
      trace.push(`After-hours route: forwarding to backend (${picked.name}).`);
      return {
        outcome: "AFTER_HOURS",
        targetGroup: "BACKEND",
        advisorIds: [picked.id],
        trace,
      };
    }
    trace.push("After-hours mode = CRAIG but no BACKEND advisor configured.");
    return { outcome: "AFTER_HOURS", advisorIds: [], trace };
  }

  // ── In hours ──────────────────────────────────────────────────────────────
  const aPool = advisors.filter((a) => a.group === "A");
  const bPool = advisors.filter((a) => a.group === "B");
  trace.push(`Pool sizes: Group A=${aPool.length}, Group B=${bPool.length}.`);

  const tryGroup = (pool: AdvisorWithSchedule[], label: AdvisorGroup) => {
    const eligible: AdvisorWithSchedule[] = [];
    for (const a of pool) {
      const r = advisorEligibility(a, band, hours, now);
      if (r.eligible) eligible.push(a);
      else trace.push(`Group ${label} • ${a.name}: ${r.reason}.`);
    }
    return eligible;
  };

  if (band === "HIGH") {
    const eligibleA = tryGroup(aPool, "A");
    if (eligibleA.length) {
      const picked = pickByPriorityAndLoad(eligibleA);
      trace.push(`HIGH → Group A pick: ${picked.name} (lowest load).`);
      return { outcome: "ASSIGN", targetGroup: "A", advisorIds: [picked.id], trace };
    }
    trace.push("HIGH but no Group A advisor eligible. Falling back to Group B.");
    const eligibleB = tryGroup(bPool, "B");
    if (eligibleB.length) {
      const picked = pickByPriorityAndLoad(eligibleB);
      trace.push(`Fallback Group B pick: ${picked.name}.`);
      return { outcome: "ASSIGN", targetGroup: "B", advisorIds: [picked.id], trace };
    }
    trace.push("No advisor eligible at all.");
    return { outcome: "UNASSIGNED", advisorIds: [], trace };
  }

  if (band === "MID") {
    const eligibleA = tryGroup(aPool, "A");
    if (eligibleA.length) {
      const picked = pickByPriorityAndLoad(eligibleA);
      trace.push(`MID → Group A still has capacity: ${picked.name}.`);
      return { outcome: "ASSIGN", targetGroup: "A", advisorIds: [picked.id], trace };
    }
    trace.push("MID and Group A full/unavailable. Trying Group B.");
    const eligibleB = tryGroup(bPool, "B");
    if (eligibleB.length) {
      const picked = pickByPriorityAndLoad(eligibleB);
      trace.push(`MID → Group B pick: ${picked.name}.`);
      return { outcome: "ASSIGN", targetGroup: "B", advisorIds: [picked.id], trace };
    }
    return { outcome: "UNASSIGNED", advisorIds: [], trace };
  }

  // LOW → Group B / backend
  trace.push("LOW lead → routing to Group B / backend.");
  const eligibleB = tryGroup(bPool, "B");
  if (eligibleB.length) {
    const picked = pickByPriorityAndLoad(eligibleB);
    trace.push(`LOW → Group B pick: ${picked.name}.`);
    return { outcome: "ASSIGN", targetGroup: "B", advisorIds: [picked.id], trace };
  }
  const backend = advisors.filter(
    (a) => a.group === "BACKEND" && a.status === "ACTIVE" && a.acceptsLow
  );
  if (backend.length) {
    const picked = pickByPriorityAndLoad(backend);
    trace.push(`LOW → backend fallback: ${picked.name}.`);
    return { outcome: "ASSIGN", targetGroup: "BACKEND", advisorIds: [picked.id], trace };
  }
  return { outcome: "UNASSIGNED", advisorIds: [], trace };
}

/** Lowest priority value wins; tie-break on fewest leads today; then by name. */
export function pickByPriorityAndLoad<T extends AdvisorWithSchedule>(pool: T[]): T {
  return [...pool].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.leadsReceivedToday !== b.leadsReceivedToday)
      return a.leadsReceivedToday - b.leadsReceivedToday;
    return a.name.localeCompare(b.name);
  })[0];
}

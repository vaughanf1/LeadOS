import type { QualityBand } from "@prisma/client";
import type { ScoringThresholds } from "./settings-defaults";

export type LeadFactors = {
  age?: number | null;
  propertyValue?: number | null;
  mortgageRemaining?: number | null;
  urgency?: string | null;
};

export type ScoreBreakdown = {
  total: number;
  band: QualityBand;
  components: { factor: string; points: number; reason: string }[];
};

function ageScore(age: number | null | undefined, t: ScoringThresholds) {
  if (age === null || age === undefined) return { points: 0, reason: "age unknown" };
  for (const b of t.ageBands) {
    if (age >= b.min && age <= b.max) {
      return { points: b.points, reason: `age ${age} in [${b.min}-${b.max}]` };
    }
  }
  return { points: 0, reason: `age ${age} matched no band` };
}

function mortgageScore(value: number | null | undefined, t: ScoringThresholds) {
  if (value === null || value === undefined) {
    return { points: 0, reason: "mortgage remaining unknown" };
  }
  // Bands are ordered low→high by maxPounds; first match wins.
  for (const b of t.mortgageBands) {
    if (value <= b.maxPounds) {
      return { points: b.points, reason: `mortgage £${value} ≤ £${b.maxPounds}` };
    }
  }
  return { points: 0, reason: `mortgage £${value} matched no band` };
}

function urgencyScore(urgency: string | null | undefined, t: ScoringThresholds) {
  if (!urgency) return { points: 0, reason: "urgency unknown" };
  const key = urgency.toLowerCase().trim();
  // Direct match first.
  if (key in t.urgencyPoints) {
    return { points: t.urgencyPoints[key], reason: `urgency "${urgency}"` };
  }
  // Substring fallback — Facebook answers are free-form.
  for (const [k, v] of Object.entries(t.urgencyPoints)) {
    if (key.includes(k)) return { points: v, reason: `urgency contains "${k}"` };
  }
  return { points: 0, reason: `urgency "${urgency}" not recognised` };
}

function propertyScore(value: number | null | undefined, t: ScoringThresholds) {
  if (value === null || value === undefined) {
    return { points: 0, reason: "property value unknown" };
  }
  // Bands ordered high→low by minPounds; first match wins.
  for (const b of t.propertyValueBands) {
    if (value >= b.minPounds) {
      return { points: b.points, reason: `property £${value} ≥ £${b.minPounds}` };
    }
  }
  return { points: 0, reason: `property £${value} matched no band` };
}

export function scoreLead(
  factors: LeadFactors,
  thresholds: ScoringThresholds
): ScoreBreakdown {
  const components: ScoreBreakdown["components"] = [];

  const a = ageScore(factors.age, thresholds);
  components.push({ factor: "age", ...a });

  const m = mortgageScore(factors.mortgageRemaining, thresholds);
  components.push({ factor: "mortgage", ...m });

  const u = urgencyScore(factors.urgency, thresholds);
  components.push({ factor: "urgency", ...u });

  const p = propertyScore(factors.propertyValue, thresholds);
  components.push({ factor: "property", ...p });

  const total = components.reduce((sum, c) => sum + c.points, 0);
  const band: QualityBand =
    total >= thresholds.highMin ? "HIGH" : total >= thresholds.midMin ? "MID" : "LOW";

  return { total, band, components };
}

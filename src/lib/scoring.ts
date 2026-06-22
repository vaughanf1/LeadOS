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

// Age gates. Equity-release leads skew older, so age is the primary signal and
// under-60s are low priority regardless of urgency.
const MID_AGE = 60; // "over 60"
const HIGH_AGE = 65; // "over 65"

type UrgencyTier = "urgent" | "soon" | "researching";

/**
 * Collapse the free-form urgency answer into three tiers:
 *   urgent      — "This month (urgent)" / "immediately"
 *   soon        — "Within 1-3 months" / "Within 3-6 months"
 *   researching — "Just researching for now" / blank / anything else
 */
function urgencyTier(urgency: string | null | undefined): UrgencyTier {
  const k = (urgency ?? "").toLowerCase();
  if (k.includes("urgent") || k.includes("this month") || k.includes("immediat")) {
    return "urgent";
  }
  if (k.includes("month")) return "soon";
  return "researching";
}

// Representative score per band, kept only so existing displays/logs that show a
// number still have one. The band — not the number — is what drives routing.
const BAND_SCORE: Record<QualityBand, number> = { HIGH: 100, MID: 60, LOW: 20 };

/**
 * Simple, transparent lead grading driven by age + urgency:
 *   HIGH — 65 or older AND acting now ("this month")
 *   MID  — 60 or older AND acting within 1–6 months (or 60–64 and acting now)
 *   LOW  — everyone else (under 60, or just researching)
 *
 * Property value and mortgage are still captured on the lead but no longer
 * affect the grade — the rule is deliberately kept simple.
 *
 * The second argument is retained for call-site compatibility but unused.
 */
export function scoreLead(
  factors: LeadFactors,
  _thresholds?: ScoringThresholds
): ScoreBreakdown {
  const age = factors.age ?? null;
  const tier = urgencyTier(factors.urgency);

  const ageLabel = age == null ? "age unknown" : `age ${age}`;
  const urgencyLabel =
    tier === "urgent"
      ? "acting now (this month)"
      : tier === "soon"
        ? "acting within 1–6 months"
        : "just researching";

  let band: QualityBand;
  let reason: string;
  if (age != null && age >= HIGH_AGE && tier === "urgent") {
    band = "HIGH";
    reason = `${ageLabel} (65+) and ${urgencyLabel}`;
  } else if (age != null && age >= MID_AGE && tier !== "researching") {
    band = "MID";
    reason = `${ageLabel} (60+) and ${urgencyLabel}`;
  } else {
    band = "LOW";
    reason =
      age == null
        ? "age unknown"
        : age < MID_AGE
          ? `${ageLabel} (under 60)`
          : `${ageLabel} but ${urgencyLabel}`;
  }

  const components = [
    { factor: "age", points: 0, reason: ageLabel },
    { factor: "urgency", points: 0, reason: urgencyLabel },
    { factor: "grade", points: BAND_SCORE[band], reason },
  ];

  return { total: BAND_SCORE[band], band, components };
}

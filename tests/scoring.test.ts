import { describe, it, expect } from "vitest";
import { scoreLead } from "@/lib/scoring";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const T = DEFAULT_SETTINGS["scoring.thresholds"];

describe("scoreLead", () => {
  it("scores a strong HIGH lead", () => {
    const r = scoreLead(
      { age: 70, propertyValue: 400_000, mortgageRemaining: 10_000, urgency: "immediately" },
      T
    );
    // 25 + 30 + 30 + 15 = 100
    expect(r.total).toBe(100);
    expect(r.band).toBe("HIGH");
  });

  it("scores a MID lead near the threshold", () => {
    const r = scoreLead(
      { age: 60, propertyValue: 250_000, mortgageRemaining: 40_000, urgency: "3-6 months" },
      T
    );
    // 15 + 20 + 10 + 10 = 55 → MID
    expect(r.total).toBe(55);
    expect(r.band).toBe("MID");
  });

  it("scores a LOW lead (young, big mortgage, researching)", () => {
    const r = scoreLead(
      { age: 50, propertyValue: 180_000, mortgageRemaining: 200_000, urgency: "just researching" },
      T
    );
    // -30 + -25 + -10 + -10 = -75
    expect(r.total).toBeLessThan(T.midMin);
    expect(r.band).toBe("LOW");
  });

  it("handles missing fields gracefully", () => {
    const r = scoreLead({}, T);
    expect(r.total).toBe(0);
    expect(r.band).toBe("LOW");
  });

  it("matches urgency substrings (FB free-form)", () => {
    const r = scoreLead({ age: 70, urgency: "I'd like to act immediately please" }, T);
    expect(r.components.find((c) => c.factor === "urgency")?.points).toBe(30);
  });
});

import { describe, it, expect } from "vitest";
import { scoreLead } from "@/lib/scoring";

describe("scoreLead — simple age + urgency grading", () => {
  it("HIGH: 65 or older and acting now", () => {
    const r = scoreLead({ age: 68, urgency: "This month (urgent)" });
    expect(r.band).toBe("HIGH");
    expect(r.total).toBe(100);
  });

  it("MID: over 60 and acting within 1–3 months", () => {
    const r = scoreLead({ age: 63, urgency: "Within 1-3 months" });
    expect(r.band).toBe("MID");
  });

  it("MID: over 60 and acting within 3–6 months", () => {
    expect(scoreLead({ age: 68, urgency: "Within 3-6 months" }).band).toBe("MID");
  });

  it("MID not HIGH: under 65 even when acting now", () => {
    // 61-65 band (midpoint 63) is over 60 but not over 65.
    expect(scoreLead({ age: 63, urgency: "This month (urgent)" }).band).toBe("MID");
  });

  it("LOW: under 60 and just researching", () => {
    expect(scoreLead({ age: 58, urgency: "Just researching for now" }).band).toBe("LOW");
  });

  it("LOW: under 60 even when acting now", () => {
    expect(scoreLead({ age: 58, urgency: "This month (urgent)" }).band).toBe("LOW");
  });

  it("LOW: older but only researching", () => {
    expect(scoreLead({ age: 75, urgency: "Just researching for now" }).band).toBe("LOW");
  });

  it("ignores property value and mortgage", () => {
    const a = scoreLead({ age: 58, urgency: "Just researching for now", propertyValue: 900_000, mortgageRemaining: 0 });
    expect(a.band).toBe("LOW");
  });

  it("handles missing fields gracefully", () => {
    const r = scoreLead({});
    expect(r.band).toBe("LOW");
  });
});

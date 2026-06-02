import { describe, it, expect } from "vitest";
import type { Lead, Advisor } from "@prisma/client";
import { emailTemplate } from "@/lib/notifications/templates";

const lead = {
  fullName: "John Smith",
  phone: "+447900000000",
  email: "john@example.com",
  postcode: "W1A 1AA",
  age: 68,
  propertyValue: 350_000,
  mortgageRemaining: 20_000,
  urgency: "1-3 months",
  loanPurpose: "Home improvements, Clearing debts",
  qualityBand: "LOW",
  qualityScore: -75,
  receivedAt: new Date("2026-06-02T16:00:00Z"),
} as unknown as Lead;

const advisor = (group: string, name = "Someone") =>
  ({ group, name, email: `${name.toLowerCase()}@example.com` } as unknown as Advisor);

describe("emailTemplate quality visibility", () => {
  it("hides the quality band + score from a front-line advisor (Group A/B)", () => {
    const { subject, text } = emailTemplate(lead, advisor("A", "Tony"));
    expect(text).not.toContain("Lead Quality");
    expect(text).not.toContain("-75");
    expect(text).not.toContain("LOW");
    expect(subject).toBe("New Equity Release Lead — John Smith");
  });

  it("shows the quality band + score to the backend team (Craig/Kasia)", () => {
    expect(emailTemplate(lead, advisor("BACKEND", "Kasia")).text).toContain(
      "Lead Quality: LOW (score -75)"
    );
    expect(emailTemplate(lead, advisor("BACKEND", "Craig")).text).toContain(
      "Lead Quality: LOW (score -75)"
    );
  });

  it("hides the score on shared alert emails (no advisor)", () => {
    const { text } = emailTemplate(lead, null);
    expect(text).not.toContain("Lead Quality");
  });

  it("always shows the loan purpose", () => {
    const { text } = emailTemplate(lead, advisor("A", "Tony"));
    expect(text).toContain("Needs Money For: Home improvements, Clearing debts");
  });
});

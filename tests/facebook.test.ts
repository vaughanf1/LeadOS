import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";
import { verifySignature, normaliseFbLead, leadDisplayAnswers } from "@/lib/facebook";

describe("verifySignature", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = "test-secret";
  });

  it("accepts a correctly-signed body", () => {
    const body = '{"hello":"world"}';
    const sig = "sha256=" + crypto.createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifySignature(body, sig)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = '{"hello":"world"}';
    const sig = "sha256=" + crypto.createHmac("sha256", "test-secret").update(body).digest("hex");
    expect(verifySignature(body + " ", sig)).toBe(false);
  });

  it("rejects missing signature header", () => {
    expect(verifySignature("{}", null)).toBe(false);
  });
});

describe("normaliseFbLead", () => {
  it("flattens field_data into the Lead shape", () => {
    const normalised = normaliseFbLead({
      id: "leadgen_123",
      created_time: "2026-05-15T09:30:00+0000",
      ad_id: "ad_1",
      form_id: "form_1",
      field_data: [
        { name: "full_name", values: ["Jane Doe"] },
        { name: "phone_number", values: ["+447900000000"] },
        { name: "email", values: ["jane@example.com"] },
        { name: "postcode", values: ["E1 6AN"] },
        { name: "age", values: ["68"] },
        { name: "property_value", values: ["£350,000"] },
        { name: "mortgage_outstanding", values: ["£25,000"] },
        { name: "urgency", values: ["1-3 months"] },
      ],
    });

    expect(normalised.facebookLeadgenId).toBe("leadgen_123");
    expect(normalised.fullName).toBe("Jane Doe");
    expect(normalised.phone).toBe("+447900000000");
    expect(normalised.email).toBe("jane@example.com");
    expect(normalised.postcode).toBe("E1 6AN");
    expect(normalised.age).toBe(68);
    expect(normalised.propertyValue).toBe(350_000);
    expect(normalised.mortgageRemaining).toBe(25_000);
    expect(normalised.urgency).toBe("1-3 months");
  });

  it("captures multi-select loan purpose from an underscored question key", () => {
    const r = normaliseFbLead({
      id: "x",
      created_time: "",
      field_data: [
        {
          name: "what_would_you_use_the_money_for?_(select_all_that_apply)",
          values: ["Home improvements", "Clearing debts"],
        },
      ],
    });
    expect(r.loanPurpose).toBe("Home improvements, Clearing debts");
  });

  it("falls back to first_name + last_name when full_name absent", () => {
    const r = normaliseFbLead({
      id: "x",
      created_time: "",
      field_data: [
        { name: "first_name", values: ["John"] },
        { name: "last_name", values: ["Smith"] },
      ],
    });
    expect(r.fullName).toBe("John Smith");
  });

  it("parses k/m suffixes instead of dropping them (1000× bug)", () => {
    const mk = (mort: string) =>
      normaliseFbLead({
        id: "x",
        created_time: "",
        field_data: [{ name: "mortgage", values: [mort] }],
      }).mortgageRemaining;
    // "£100k-£150k" → midpoint of 100,000 and 150,000, not 125.
    expect(mk("Yes, with a mortgage (£100k-£150k remaining)")).toBe(125_000);
    expect(mk("Yes, with a mortgage (£150-£200k remaining)")).toBe(175_000);
    expect(mk("Yes, with a mortgage (Over £200k remaining)")).toBe(200_000);
    expect(mk("Yes, with a small mortgage (under £50,000 remaining)")).toBe(50_000);
  });

  it("takes the midpoint of a property-value range", () => {
    const r = normaliseFbLead({
      id: "x",
      created_time: "",
      field_data: [{ name: "property_value", values: ["£200,000 - £300,000"] }],
    });
    expect(r.propertyValue).toBe(250_000);
  });
});

describe("leadDisplayAnswers", () => {
  it("returns the customer's verbatim answers from field_data", () => {
    const a = leadDisplayAnswers({
      field_data: [
        { name: "age", values: ["61-65"] },
        { name: "property_value", values: ["£200,000 - £300,000"] },
        { name: "mortgage", values: ["Yes, with a mortgage (£100k-£150k remaining)"] },
      ],
    });
    expect(a.age).toBe("61-65");
    expect(a.propertyValue).toBe("£200,000 - £300,000");
    expect(a.mortgage).toBe("Yes, with a mortgage (£100k-£150k remaining)");
  });

  it("reads a flat (Zapier) payload too, and is null-safe", () => {
    const a = leadDisplayAnswers({ age: "71-75", property_value: "£400,000 - £500,000" });
    expect(a.age).toBe("71-75");
    expect(a.propertyValue).toBe("£400,000 - £500,000");
    expect(a.mortgage).toBeNull();
    expect(leadDisplayAnswers(null).age).toBeNull();
  });
});

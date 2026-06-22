import type { Lead, Advisor } from "@prisma/client";
import { formatGBP, formatDateTime } from "../utils";
import { leadDisplayAnswers } from "../facebook";

/**
 * Whether this recipient is allowed to see the internal lead quality band +
 * score in their notification. Hidden from front-line advisers (Groups A/B) —
 * it biases how hard they work a lead — and shown only to the backend
 * oversight team (Craig + Kasia). Everyone with dashboard access still sees it.
 */
function canSeeScore(advisor: Advisor | null): boolean {
  return advisor?.group === "BACKEND";
}

export function smsTemplate(lead: Lead) {
  // Advisers should see the customer's actual answers ("61-65", "£200,000 -
  // £300,000"), not the midpoint integers used internally for scoring.
  const a = leadDisplayAnswers(lead.rawPayload);
  return [
    "New equity release lead:",
    "",
    `Name: ${lead.fullName}`,
    `Phone: ${lead.phone ?? "—"}`,
    `Age: ${a.age ?? lead.age ?? "—"}`,
    `Property Value: ${a.propertyValue ?? formatGBP(lead.propertyValue)}`,
    `Mortgage Left: ${a.mortgage ?? formatGBP(lead.mortgageRemaining)}`,
    `Urgency: ${lead.urgency ?? "—"}`,
    `Needs Money For: ${lead.loanPurpose ?? "—"}`,
    "",
    "Call ASAP.",
  ].join("\n");
}

export function emailTemplate(lead: Lead, advisor: Advisor | null) {
  const a = leadDisplayAnswers(lead.rawPayload);
  const subject = `New Equity Release Lead — ${lead.fullName}`;
  const text = [
    `Name: ${lead.fullName}`,
    `Phone: ${lead.phone ?? "—"}`,
    `Email: ${lead.email ?? "—"}`,
    `Postcode: ${lead.postcode ?? "—"}`,
    ...(a.title ? [`Title: ${a.title}`] : []),
    `Age: ${a.age ?? lead.age ?? "—"}`,
    `Property Value: ${a.propertyValue ?? formatGBP(lead.propertyValue)}`,
    `Mortgage Remaining: ${a.mortgage ?? formatGBP(lead.mortgageRemaining)}`,
    `Urgency: ${lead.urgency ?? "—"}`,
    `Needs Money For: ${lead.loanPurpose ?? "—"}`,
    // Quality band + score only for permitted recipients (Kasia); hidden from advisers.
    ...(canSeeScore(advisor)
      ? [`Lead Quality: ${lead.qualityBand ?? "—"} (score ${lead.qualityScore ?? "—"})`]
      : []),
    `Received At: ${formatDateTime(lead.receivedAt)}`,
    `Assigned To: ${advisor?.name ?? "—"}`,
  ].join("\n");

  const html = `<table style="font-family:Inter,sans-serif;font-size:15px;line-height:1.6">
${text
  .split("\n")
  .map((row) => {
    const [k, ...rest] = row.split(":");
    return `<tr><td style="color:#6B7280;padding-right:12px"><strong>${k}</strong></td><td>${rest.join(":").trim()}</td></tr>`;
  })
  .join("")}
</table>`;

  return { subject, text, html };
}

import type { Lead, Advisor } from "@prisma/client";
import { formatGBP, formatDateTime } from "../utils";

export function smsTemplate(lead: Lead) {
  return [
    "New equity release lead:",
    "",
    `Name: ${lead.fullName}`,
    `Phone: ${lead.phone ?? "—"}`,
    `Age: ${lead.age ?? "—"}`,
    `Property Value: ${formatGBP(lead.propertyValue)}`,
    `Mortgage Left: ${formatGBP(lead.mortgageRemaining)}`,
    `Urgency: ${lead.urgency ?? "—"}`,
    `Needs Money For: ${lead.loanPurpose ?? "—"}`,
    `Quality: ${lead.qualityBand ?? "—"}`,
    "",
    "Call ASAP.",
  ].join("\n");
}

export function emailTemplate(lead: Lead, advisor: Advisor | null) {
  const subject = `New ${lead.qualityBand ?? "—"} Equity Release Lead — ${lead.fullName}`;
  const text = [
    `Name: ${lead.fullName}`,
    `Phone: ${lead.phone ?? "—"}`,
    `Email: ${lead.email ?? "—"}`,
    `Postcode: ${lead.postcode ?? "—"}`,
    `Age: ${lead.age ?? "—"}`,
    `Property Value: ${formatGBP(lead.propertyValue)}`,
    `Mortgage Remaining: ${formatGBP(lead.mortgageRemaining)}`,
    `Urgency: ${lead.urgency ?? "—"}`,
    `Needs Money For: ${lead.loanPurpose ?? "—"}`,
    `Lead Quality: ${lead.qualityBand ?? "—"} (score ${lead.qualityScore ?? "—"})`,
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

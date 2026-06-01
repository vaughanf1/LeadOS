import type { Lead } from "@prisma/client";
import { prisma } from "./prisma";
import { getAllSettings } from "./settings";
import { scoreLead } from "./scoring";
import { planDistribution, type AdvisorWithSchedule } from "./distribution";
import { notifyAdvisor, notifyAfterHoursAdmins, notifyUnassignedFallback } from "./notifications";

/**
 * Run a freshly-stored lead through scoring + distribution + notification.
 * Caller must have already created the Lead row. Returns the (possibly mutated)
 * Lead with status set, plus the decision plan trace.
 */
export async function processLead(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const settings = await getAllSettings();

  // 1) Score
  const breakdown = scoreLead(
    {
      age: lead.age,
      propertyValue: lead.propertyValue,
      mortgageRemaining: lead.mortgageRemaining,
      urgency: lead.urgency,
    },
    settings["scoring.thresholds"]
  );

  await prisma.lead.update({
    where: { id: lead.id },
    data: { qualityScore: breakdown.total, qualityBand: breakdown.band },
  });
  await prisma.leadLog.create({
    data: {
      leadId: lead.id,
      message: `Scored ${breakdown.band} (${breakdown.total}).`,
      meta: { components: breakdown.components },
    },
  });

  // 2) Plan distribution
  const advisors = (await prisma.advisor.findMany({
    include: { schedules: true },
  })) as AdvisorWithSchedule[];

  const plan = planDistribution({
    lead: { qualityBand: breakdown.band },
    advisors,
    hours: settings["hours.working"],
    afterHoursMode: settings["afterHours.config"].mode,
  });

  for (const line of plan.trace) {
    await prisma.leadLog.create({ data: { leadId: lead.id, message: line } });
  }

  // 3) Apply plan
  if (plan.outcome === "UNASSIGNED") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "NEW", assignedGroup: null },
    });
    await prisma.leadLog.create({
      data: { leadId: lead.id, level: "warn", message: "No advisor available — lead left UNASSIGNED." },
    });
    const unassigned = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    const fallbackResults = await notifyUnassignedFallback(unassigned);
    const allOk = fallbackResults.every((r) => r.ok);
    await prisma.leadLog.create({
      data: {
        leadId: lead.id,
        level: allOk ? "info" : "error",
        message: allOk
          ? `Fallback alert sent: ${fallbackResults.map((r) => r.channel).join(", ")}.`
          : `Fallback alert failure: ${fallbackResults
              .filter((r) => !r.ok)
              .map((r) => `${r.channel}=${r.error ?? "?"}`)
              .join("; ")}`,
      },
    });
    return { plan, status: "NEW" as const };
  }

  if (plan.outcome === "HOLD") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "HELD" },
    });
    return { plan, status: "HELD" as const };
  }

  if (plan.outcome === "AFTER_HOURS") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: "AFTER_HOURS", assignedGroup: "BACKEND" },
    });
    const updated = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    await notifyAfterHoursAdmins(updated);
    // Still create assignment record for trail if a backend advisor was identified.
    for (const advisorId of plan.advisorIds) {
      await prisma.leadAssignment.create({
        data: { leadId: lead.id, advisorId },
      });
      await prisma.advisor.update({
        where: { id: advisorId },
        data: { leadsReceivedToday: { increment: 1 } },
      });
      const adv = await prisma.advisor.findUniqueOrThrow({ where: { id: advisorId } });
      await notifyAdvisor(updated, adv);
    }
    return { plan, status: "AFTER_HOURS" as const };
  }

  // ASSIGN
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: "ASSIGNED",
      assignedGroup: plan.targetGroup,
      sentAt: new Date(),
    },
  });

  const sent = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  for (const advisorId of plan.advisorIds) {
    await prisma.leadAssignment.create({
      data: { leadId: lead.id, advisorId },
    });
    await prisma.advisor.update({
      where: { id: advisorId },
      data: { leadsReceivedToday: { increment: 1 } },
    });
    const adv = await prisma.advisor.findUniqueOrThrow({ where: { id: advisorId } });
    const results = await notifyAdvisor(sent, adv);
    const allOk = results.every((r) => r.ok);
    await prisma.leadLog.create({
      data: {
        leadId: lead.id,
        level: allOk ? "info" : "error",
        message: allOk
          ? `Notified ${adv.name}: ${results.map((r) => r.channel).join(", ")}.`
          : `Notification failure for ${adv.name}: ${results
              .filter((r) => !r.ok)
              .map((r) => `${r.channel}=${r.error ?? "?"}`)
              .join("; ")}`,
      },
    });
  }

  // Mark SENT if at least one notification went out.
  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: "SENT" },
  });

  return { plan, status: "SENT" as const };
}

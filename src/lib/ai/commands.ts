import { z } from "zod";
import { prisma } from "../prisma";
import type { AdvisorGroup, AdvisorStatus, DeliveryPref } from "@prisma/client";

/**
 * Catalogue of admin actions the AI can produce. Each has:
 *  - a zod schema (used to validate the AI output)
 *  - a `destructive` flag (true → must be confirmed by the user before applying)
 *  - an `apply` function (only called after validation)
 */

export const PauseAdvisorSchema = z.object({
  action: z.literal("pause_advisor"),
  advisorName: z.string(),
  pausedUntil: z.string().optional(), // ISO date
});

export const ResumeAdvisorSchema = z.object({
  action: z.literal("resume_advisor"),
  advisorName: z.string(),
});

export const SetDailyCapSchema = z.object({
  action: z.literal("set_daily_cap"),
  advisorName: z.string(),
  dailyLeadCap: z.number().int().min(0).max(50),
});

export const MoveGroupSchema = z.object({
  action: z.literal("move_group"),
  advisorName: z.string(),
  group: z.enum(["A", "B", "BACKEND"]),
});

export const SetStatusSchema = z.object({
  action: z.literal("set_status"),
  advisorName: z.string(),
  status: z.enum(["ACTIVE", "PAUSED", "HOLIDAY", "FULL"]),
});

export const SetDeliverySchema = z.object({
  action: z.literal("set_delivery"),
  advisorName: z.string(),
  delivery: z.enum(["SMS", "EMAIL", "BOTH"]),
});

export const SetScheduleSchema = z.object({
  action: z.literal("set_schedule"),
  advisorName: z.string(),
  days: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const QueryTodaySchema = z.object({
  action: z.literal("query_today_assignments"),
});

export const QueryUnassignedSchema = z.object({
  action: z.literal("query_unassigned_leads"),
});

export const QueryAdvisorsSchema = z.object({
  action: z.literal("query_advisors"),
});

export const SendNextLeadsSchema = z.object({
  action: z.literal("send_next_leads_to"),
  advisorNames: z.array(z.string()).min(1),
  count: z.number().int().min(1).max(20),
});

export const CommandSchema = z.discriminatedUnion("action", [
  PauseAdvisorSchema,
  ResumeAdvisorSchema,
  SetDailyCapSchema,
  MoveGroupSchema,
  SetStatusSchema,
  SetDeliverySchema,
  SetScheduleSchema,
  QueryTodaySchema,
  QueryUnassignedSchema,
  QueryAdvisorsSchema,
  SendNextLeadsSchema,
]);

export type Command = z.infer<typeof CommandSchema>;

export function isDestructive(cmd: Command): boolean {
  return !cmd.action.startsWith("query_");
}

async function findAdvisorByName(name: string) {
  const trimmed = name.trim();
  const exact = await prisma.advisor.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (exact) return exact;
  return prisma.advisor.findFirst({
    where: { name: { contains: trimmed, mode: "insensitive" } },
  });
}

export async function describeCommand(cmd: Command): Promise<string> {
  switch (cmd.action) {
    case "pause_advisor":
      return `Pause ${cmd.advisorName}${cmd.pausedUntil ? ` until ${cmd.pausedUntil}` : ""}.`;
    case "resume_advisor":
      return `Resume ${cmd.advisorName}.`;
    case "set_daily_cap":
      return `Set ${cmd.advisorName}'s daily lead cap to ${cmd.dailyLeadCap}.`;
    case "move_group":
      return `Move ${cmd.advisorName} to Group ${cmd.group}.`;
    case "set_status":
      return `Set ${cmd.advisorName} status to ${cmd.status}.`;
    case "set_delivery":
      return `Set ${cmd.advisorName} delivery to ${cmd.delivery}.`;
    case "set_schedule": {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Set ${cmd.advisorName}'s schedule to ${cmd.days.map((d) => dayNames[d]).join(", ")} ${cmd.startTime}-${cmd.endTime}.`;
    }
    case "query_today_assignments":
      return "Show me who has received leads today.";
    case "query_unassigned_leads":
      return "Show me unassigned leads.";
    case "query_advisors":
      return "List all advisors and their status.";
    case "send_next_leads_to":
      return `Send the next ${cmd.count} lead(s) to ${cmd.advisorNames.join(", ")}.`;
  }
}

export async function applyCommand(cmd: Command): Promise<{ ok: boolean; message: string }> {
  switch (cmd.action) {
    case "pause_advisor": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisor.update({
        where: { id: a.id },
        data: {
          status: "PAUSED",
          pausedUntil: cmd.pausedUntil ? new Date(cmd.pausedUntil) : null,
        },
      });
      return { ok: true, message: `${a.name} paused${cmd.pausedUntil ? ` until ${cmd.pausedUntil}` : ""}.` };
    }

    case "resume_advisor": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisor.update({
        where: { id: a.id },
        data: { status: "ACTIVE", pausedUntil: null },
      });
      return { ok: true, message: `${a.name} resumed.` };
    }

    case "set_daily_cap": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisor.update({
        where: { id: a.id },
        data: { dailyLeadCap: cmd.dailyLeadCap },
      });
      return { ok: true, message: `${a.name}'s daily cap is now ${cmd.dailyLeadCap}.` };
    }

    case "move_group": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisor.update({
        where: { id: a.id },
        data: { group: cmd.group as AdvisorGroup },
      });
      return { ok: true, message: `${a.name} moved to Group ${cmd.group}.` };
    }

    case "set_status": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisor.update({
        where: { id: a.id },
        data: { status: cmd.status as AdvisorStatus },
      });
      return { ok: true, message: `${a.name} status set to ${cmd.status}.` };
    }

    case "set_delivery": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisor.update({
        where: { id: a.id },
        data: { preferredDelivery: cmd.delivery as DeliveryPref },
      });
      return { ok: true, message: `${a.name} delivery set to ${cmd.delivery}.` };
    }

    case "set_schedule": {
      const a = await findAdvisorByName(cmd.advisorName);
      if (!a) return { ok: false, message: `Advisor "${cmd.advisorName}" not found.` };
      await prisma.advisorSchedule.deleteMany({ where: { advisorId: a.id } });
      for (const day of cmd.days) {
        await prisma.advisorSchedule.create({
          data: {
            advisorId: a.id,
            dayOfWeek: day,
            startTime: cmd.startTime,
            endTime: cmd.endTime,
            enabled: true,
          },
        });
      }
      return { ok: true, message: `${a.name} schedule updated.` };
    }

    case "query_today_assignments": {
      const since = startOfTodayUK();
      const assignments = await prisma.leadAssignment.findMany({
        where: { createdAt: { gte: since } },
        include: { advisor: true, lead: true },
        orderBy: { createdAt: "desc" },
      });
      if (assignments.length === 0) return { ok: true, message: "Nobody has received leads today." };
      const byAdvisor = new Map<string, number>();
      for (const a of assignments) {
        byAdvisor.set(a.advisor.name, (byAdvisor.get(a.advisor.name) ?? 0) + 1);
      }
      const lines = [...byAdvisor.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([n, c]) => `• ${n}: ${c}`);
      return { ok: true, message: `Today (${assignments.length} total):\n${lines.join("\n")}` };
    }

    case "query_unassigned_leads": {
      const leads = await prisma.lead.findMany({
        where: { status: { in: ["NEW", "HELD"] } },
        orderBy: { receivedAt: "desc" },
        take: 20,
      });
      if (leads.length === 0) return { ok: true, message: "No unassigned leads." };
      return {
        ok: true,
        message:
          `${leads.length} unassigned lead(s):\n` +
          leads.map((l) => `• ${l.fullName} (${l.qualityBand ?? "?"})`).join("\n"),
      };
    }

    case "query_advisors": {
      const advisors = await prisma.advisor.findMany({
        orderBy: [{ group: "asc" }, { priority: "asc" }],
      });
      return {
        ok: true,
        message: advisors
          .map(
            (a) =>
              `• ${a.name} — Group ${a.group}, ${a.status}, ${a.leadsReceivedToday}/${a.dailyLeadCap} today`
          )
          .join("\n"),
      };
    }

    case "send_next_leads_to": {
      const advisors = (
        await Promise.all(cmd.advisorNames.map((n) => findAdvisorByName(n)))
      ).filter(Boolean) as Awaited<ReturnType<typeof findAdvisorByName>>[];
      if (advisors.length === 0) {
        return { ok: false, message: "None of those advisors could be found." };
      }
      const pending = await prisma.lead.findMany({
        where: { status: { in: ["NEW", "HELD"] } },
        orderBy: { receivedAt: "asc" },
        take: cmd.count * advisors.length,
      });
      const { notifyAdvisor } = await import("../notifications");
      let i = 0;
      const results: string[] = [];
      for (const lead of pending) {
        const adv = advisors[i % advisors.length]!;
        i++;
        await prisma.leadAssignment.create({ data: { leadId: lead.id, advisorId: adv.id } });
        await prisma.advisor.update({
          where: { id: adv.id },
          data: { leadsReceivedToday: { increment: 1 } },
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "SENT", assignedGroup: adv.group, sentAt: new Date() },
        });
        await prisma.leadLog.create({
          data: { leadId: lead.id, message: `Manual assign via AI to ${adv.name}.` },
        });
        await notifyAdvisor(lead, adv);
        results.push(`${lead.fullName} → ${adv.name}`);
      }
      if (results.length === 0) return { ok: true, message: "No pending leads to send." };
      return { ok: true, message: `Sent ${results.length}:\n${results.map((r) => "• " + r).join("\n")}` };
    }
  }
}

function startOfTodayUK(): Date {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}

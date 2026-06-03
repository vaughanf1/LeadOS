import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const SINK_NAME = "ZZZ TEST SINK (delete me)";
const SINK_EMAIL = "vaughanfawcett1@gmail.com";

async function main() {
  const cmd = process.argv[2];

  if (cmd === "sink-create") {
    const existing = await p.advisor.findFirst({ where: { name: SINK_NAME } });
    if (existing) {
      console.log("sink already exists: " + existing.id);
      return;
    }
    const a = await p.advisor.create({
      data: {
        name: SINK_NAME,
        email: SINK_EMAIL,
        group: "BACKEND",
        status: "ACTIVE",
        preferredDelivery: "EMAIL",
        priority: 1, // beats everyone → wins backend fallback for LOW leads
        dailyLeadCap: 100,
        acceptsHigh: true,
        acceptsMid: true,
        acceptsLow: true,
        weekendEnabled: true,
      },
    });
    console.log("sink created: " + a.id + " (email=" + a.email + ")");
    return;
  }

  if (cmd === "show") {
    const leadId = process.argv[3];
    const lead = await p.lead.findUnique({
      where: { id: leadId },
      include: { assignments: { include: { advisor: true } }, notifications: true },
    });
    if (!lead) {
      console.log("lead not found: " + leadId);
      return;
    }
    console.log("=== LEAD ===");
    console.log("name:         " + lead.fullName);
    console.log("band/score:   " + lead.qualityBand + " / " + lead.qualityScore);
    console.log("status:       " + lead.status);
    console.log("loanPurpose:  " + JSON.stringify(lead.loanPurpose));
    console.log("assigned to:  " + lead.assignments.map((x) => x.advisor.name + " <" + x.advisor.email + ">").join(", "));
    console.log("\n=== EMAIL(S) AS ACTUALLY SENT (NotificationLog) ===");
    for (const n of lead.notifications) {
      console.log("-- to=" + n.to + " | channel=" + n.channel + " | status=" + n.status + " --");
      console.log("subject: " + n.subject);
      console.log(n.body);
      console.log("");
    }
    return;
  }

  if (cmd === "cleanup") {
    const leadId = process.argv[3];
    if (leadId) {
      const lead = await p.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        await p.lead.delete({ where: { id: leadId } }); // cascades assignments/logs/notifications
        console.log("deleted test lead: " + leadId);
      }
    }
    const sink = await p.advisor.findFirst({ where: { name: SINK_NAME } });
    if (sink) {
      await p.advisor.delete({ where: { id: sink.id } });
      console.log("deleted sink adviser: " + sink.id);
    }
    return;
  }

  console.log("usage: prove.ts sink-create | show <leadId> | cleanup [leadId]");
}

main().finally(() => p.$disconnect());

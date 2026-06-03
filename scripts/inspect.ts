import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const advisors = await prisma.advisor.findMany({
    include: { schedules: true },
    orderBy: { priority: "asc" },
  });
  console.log("=== ADVISORS (" + advisors.length + ") ===");
  for (const a of advisors) {
    console.log(
      `- ${a.name} | group=${a.group} status=${a.status} prio=${a.priority} cap=${a.dailyLeadCap} today=${a.leadsReceivedToday}`,
    );
    console.log(
      `    phone=${a.phone ?? "(none)"} email=${a.email ?? "(none)"} delivery=${a.preferredDelivery} H/M/L=${a.acceptsHigh}/${a.acceptsMid}/${a.acceptsLow} weekend=${a.weekendEnabled}`,
    );
    if (a.schedules.length) {
      console.log(
        "    schedules: " +
          a.schedules
            .map((s) => `${s.dayOfWeek}:${s.startTime}-${s.endTime}${s.enabled ? "" : "(off)"}`)
            .join(", "),
      );
    }
  }

  console.log("\n=== SYSTEM SETTINGS ===");
  const settings = await prisma.systemSetting.findMany();
  for (const s of settings) {
    console.log(`- ${s.key}: ${JSON.stringify(s.value)}`);
  }

  console.log("\n=== LEADS (last 15) ===");
  const leads = await prisma.lead.findMany({
    orderBy: { receivedAt: "desc" },
    take: 15,
  });
  console.log("total leads:", await prisma.lead.count());
  for (const l of leads) {
    console.log(
      `- ${l.receivedAt.toISOString()} | ${l.fullName} | ${l.status} | band=${l.qualityBand} score=${l.qualityScore} | src=${l.source} | fbId=${l.facebookLeadgenId ?? "-"}`,
    );
  }

  console.log("\n=== NOTIFICATION LOG (last 15) ===");
  const notes = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  console.log("total notifications:", await prisma.notificationLog.count());
  for (const n of notes) {
    console.log(
      `- ${n.createdAt.toISOString()} | ${n.channel} | ${n.status} | to=${n.to} | err=${n.error ?? "-"}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const id = "cmpvgzgkz000011l0ecmhk7l0";
  const lead = await p.lead.findUnique({ where: { id } });
  console.log(`LEAD: ${lead?.fullName}`);
  console.log(`  band=${lead?.qualityBand} score=${lead?.qualityScore} status=${lead?.status} group=${(lead as any)?.assignedGroup}\n`);
  const logs = await p.leadLog.findMany({ where: { leadId: id }, orderBy: { createdAt: "asc" } });
  console.log("LEAD LOG:");
  for (const l of logs) console.log(`  [${l.level}] ${l.message}`);
  const notes = await p.notificationLog.findMany({ where: { leadId: id }, orderBy: { createdAt: "asc" } });
  console.log("\nNOTIFICATIONS:");
  for (const n of notes) console.log(`  ${n.channel} -> ${n.to} | ${n.status}${n.error ? " | ERR: " + n.error : ""}`);
  await p.$disconnect();
})();

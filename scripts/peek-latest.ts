import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const leads = await p.lead.findMany({
    orderBy: { receivedAt: "desc" },
    take: 6,
    select: { fullName: true, receivedAt: true, loanPurpose: true, source: true, rawPayload: true },
  });
  for (const l of leads) {
    console.log("=== " + l.fullName + " | " + l.receivedAt.toISOString() + " | src=" + l.source + " | loanPurpose=" + JSON.stringify(l.loanPurpose) + " ===");
    const raw: any = l.rawPayload;
    if (raw?.field_data && Array.isArray(raw.field_data)) {
      for (const f of raw.field_data) console.log("  [" + f.name + "] = " + JSON.stringify(f.values));
    } else if (raw) {
      for (const k of Object.keys(raw)) console.log("  " + k + " = " + JSON.stringify(raw[k]).slice(0, 120));
    }
  }
  await p.$disconnect();
})();

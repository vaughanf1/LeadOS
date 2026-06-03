import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Usage: tsx scripts/pause-advisor.ts <nameContains> <ACTIVE|PAUSED>
(async () => {
  const nameContains = process.argv[2] ?? "Craig";
  const status = (process.argv[3] ?? "PAUSED") as "ACTIVE" | "PAUSED";
  const adv = await p.advisor.findFirst({ where: { name: { contains: nameContains } } });
  if (!adv) {
    console.log(`No advisor matching "${nameContains}"`);
    return;
  }
  const updated = await p.advisor.update({ where: { id: adv.id }, data: { status } });
  console.log(`${updated.name}: status ${adv.status} -> ${updated.status}`);
  await p.$disconnect();
})();

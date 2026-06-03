import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const k = await p.advisor.findFirst({ where: { name: "Kasia" } });
  if (!k) return;
  const newCount = Math.max(0, k.leadsReceivedToday - 1);
  await p.advisor.update({ where: { id: k.id }, data: { leadsReceivedToday: newCount } });
  console.log(`Kasia leadsReceivedToday: ${k.leadsReceivedToday} -> ${newCount}`);
  await p.$disconnect();
})();

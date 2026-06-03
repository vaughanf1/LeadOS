import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const craig = await p.advisor.findFirst({ where: { group: "BACKEND", name: { contains: "Craig" } } });
  if (!craig) { console.log("Craig not found"); return; }
  const before = craig.email;
  const updated = await p.advisor.update({ where: { id: craig.id }, data: { email: "Craig@os4ll.co.uk" } });
  console.log(`Craig email: ${before ?? "(none)"} -> ${updated.email}`);
  await p.$disconnect();
})();

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const a = await p.advisor.findMany({ orderBy: { name: "asc" } });
  for (const x of a) {
    const o = x as any;
    if (o.status !== "ACTIVE") continue;
    console.log(
      `${x.name.padEnd(16)} | grp=${o.group} | delivery=${o.preferredDelivery} | acceptsLow=${o.acceptsLow} | prio=${o.priority ?? "?"} | email=${x.email ?? "*** MISSING ***"}`
    );
  }
  await p.$disconnect();
})();

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processLead } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  // Vercel Cron sends `x-vercel-cron: 1`. Otherwise require x-cron-secret.
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return new NextResponse("unauthorised", { status: 401 });

  const held = await prisma.lead.findMany({
    where: { status: "HELD" },
    orderBy: { receivedAt: "asc" },
    take: 200,
  });

  let processed = 0;
  for (const lead of held) {
    try {
      // Mark NEW so processLead doesn't think it's already terminal.
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "NEW" } });
      await prisma.leadLog.create({
        data: { leadId: lead.id, message: "Morning release cron: re-running distribution." },
      });
      await processLead(lead.id);
      processed++;
    } catch (err) {
      await prisma.leadLog.create({
        data: {
          leadId: lead.id,
          level: "error",
          message: `Morning release failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, processed, totalHeld: held.length });
}

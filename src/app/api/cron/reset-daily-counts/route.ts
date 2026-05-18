import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("x-cron-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return new NextResponse("unauthorised", { status: 401 });

  // Reset counters. Also auto-resume advisors whose pausedUntil has passed.
  const now = new Date();
  await prisma.advisor.updateMany({
    data: { leadsReceivedToday: 0, countersResetAt: now },
  });
  await prisma.advisor.updateMany({
    where: { status: "PAUSED", pausedUntil: { not: null, lte: now } },
    data: { status: "ACTIVE", pausedUntil: null },
  });

  return NextResponse.json({ ok: true, at: now.toISOString() });
}

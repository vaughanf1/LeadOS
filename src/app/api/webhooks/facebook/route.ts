import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySignature, fetchLead, normaliseFbLead } from "@/lib/facebook";
import { processLead } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── GET: webhook verification handshake ─────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ── POST: incoming lead event ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, sig)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: { entry?: { changes?: { value?: Record<string, unknown> }[] }[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Process every leadgen change in the payload.
  const items: Record<string, unknown>[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.value) items.push(change.value);
    }
  }

  // Return 200 quickly to Facebook, but run processing inline first.
  // (For higher throughput, push to a queue here and process out-of-band.)
  for (const value of items) {
    const leadgenId = String(value["leadgen_id"] ?? "");
    if (!leadgenId) continue;

    try {
      // Dedup check
      const existing = await prisma.lead.findUnique({
        where: { facebookLeadgenId: leadgenId },
      });
      if (existing) {
        await prisma.leadLog.create({
          data: {
            leadId: existing.id,
            level: "warn",
            message: `Duplicate webhook for leadgen ${leadgenId}; ignored.`,
          },
        });
        continue;
      }

      const fb = await fetchLead(leadgenId);
      const normalised = normaliseFbLead(fb);
      const lead = await prisma.lead.create({
        data: { ...normalised, source: "facebook", status: "NEW" },
      });
      await prisma.leadLog.create({
        data: { leadId: lead.id, message: `Lead received from Facebook (leadgen ${leadgenId}).` },
      });
      await processLead(lead.id);
    } catch (err) {
      console.error("[facebook] failed to process leadgen", leadgenId, err);
      await prisma.leadLog.create({
        data: {
          level: "error",
          message: `Failed to process leadgen ${leadgenId}: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

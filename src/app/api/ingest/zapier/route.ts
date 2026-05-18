import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normaliseFlat } from "@/lib/facebook";
import { processLead } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Zapier ingest endpoint.
 *
 * The Page's leads already flow into Zapier (a Meta-reviewed app). Rather than
 * wait on App Review for our own app's `leads_retrieval` Advanced Access, a
 * Zap forwards each new Facebook lead here. Zapier's Lead Ads trigger already
 * carries the full field data, so no Graph API round-trip or Meta signature is
 * involved — we authenticate with a shared secret instead.
 *
 * Accepts either:
 *   - Facebook's raw shape:  { id, field_data: [{ name, values: [...] }, ...] }
 *   - A flat mapped object:  { full_name, email, phone, postcode, leadgen_id, ... }
 */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.ZAPIER_INGEST_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("x-ingest-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorised(req)) {
    return new NextResponse("unauthorised", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  // Build a flat key->value map from whichever shape Zapier sends.
  const flat: Record<string, string> = {};
  const fieldData = body["field_data"];
  if (Array.isArray(fieldData)) {
    for (const f of fieldData as { name?: string; values?: unknown[] }[]) {
      if (!f?.name) continue;
      flat[String(f.name).toLowerCase().trim()] = String(f.values?.[0] ?? "").trim();
    }
  } else {
    for (const [k, v] of Object.entries(body)) {
      if (v == null || typeof v === "object") continue;
      flat[k.toLowerCase().trim()] = String(v).trim();
    }
  }

  const leadgenId =
    (body["leadgen_id"] as string) ||
    (body["facebookLeadgenId"] as string) ||
    (body["id"] as string) ||
    null;

  try {
    if (leadgenId) {
      const existing = await prisma.lead.findUnique({
        where: { facebookLeadgenId: leadgenId },
      });
      if (existing) {
        await prisma.leadLog.create({
          data: {
            leadId: existing.id,
            level: "warn",
            message: `Duplicate Zapier ingest for leadgen ${leadgenId}; ignored.`,
          },
        });
        return NextResponse.json({ ok: true, duplicate: true, leadId: existing.id });
      }
    }

    const normalised = normaliseFlat(flat, leadgenId, body);
    const lead = await prisma.lead.create({
      data: { ...normalised, source: "facebook", status: "NEW" },
    });
    await prisma.leadLog.create({
      data: {
        leadId: lead.id,
        message: `Lead received via Zapier${leadgenId ? ` (leadgen ${leadgenId})` : ""}.`,
      },
    });
    await processLead(lead.id);
    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (err) {
    console.error("[zapier] ingest failed", err);
    await prisma.leadLog.create({
      data: {
        level: "error",
        message: `Zapier ingest failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    });
    return new NextResponse("processing error", { status: 500 });
  }
}

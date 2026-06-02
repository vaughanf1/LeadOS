import crypto from "node:crypto";

/**
 * Verify Meta's X-Hub-Signature-256 header.
 * Header format: `sha256=<hex>`. HMAC computed over the raw request body
 * using META_APP_SECRET.
 */
export function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    console.warn("[facebook] META_APP_SECRET not set — skipping signature verification (DEV ONLY).");
    return true;
  }
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export type FbField = { name: string; values: string[] };
export type FbLead = {
  id: string;
  created_time: string;
  ad_id?: string;
  form_id?: string;
  field_data: FbField[];
};

export async function fetchLead(leadgenId: string): Promise<FbLead> {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN not set");
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API ${res.status}: ${body}`);
  }
  return (await res.json()) as FbLead;
}

/**
 * Normalise Facebook free-form field_data into our Lead shape. Field names from
 * Lead Forms come in many variants — we match on substrings, case-insensitive.
 */
export function normaliseFbLead(fb: FbLead) {
  const flat: Record<string, string> = {};
  for (const f of fb.field_data) {
    flat[f.name.toLowerCase().trim()] = (f.values?.[0] ?? "").trim();
  }
  return normaliseFlat(flat, fb.id, fb as unknown as object);
}

/**
 * Normalise an already-flattened key→value map into our Lead shape. Shared by
 * the Facebook webhook (via normaliseFbLead) and the Zapier ingest endpoint,
 * which receives the lead fields directly without a Graph API round-trip.
 * `leadgenId` is optional — Zapier may or may not pass Facebook's lead id.
 */
export function normaliseFlat(
  flat: Record<string, string>,
  leadgenId?: string | null,
  raw?: object
) {
  const find = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      for (const name in flat) {
        if (name.includes(k)) return flat[name];
      }
    }
    return undefined;
  };

  const fullName =
    find("full_name", "full name") ??
    `${find("first_name", "first name") ?? ""} ${find("last_name", "last name") ?? ""}`.trim();

  const ageRaw = find("age");
  const propRaw = find("property value", "house value", "home value", "property_value");
  const mortRaw = find("mortgage", "outstanding");

  const toInt = (s?: string) => {
    if (!s) return null;
    // Lead-form dropdowns send values as ranges, e.g. "£300,000 – £400,000".
    // Drop thousands separators / decimals, then take each number group. A
    // range yields >1 group → use the midpoint as the representative value
    // (matches the >= band thresholds in scoring.ts). Stripping every
    // non-digit instead concatenated the bounds into "300000400000", which
    // overflowed Postgres INT4 and made every lead.create() fail.
    const groups = s.replace(/,/g, "").replace(/\.\d+/g, "").match(/\d+/g);
    if (!groups) return null;
    const vals = groups.map((g) => parseInt(g, 10)).filter(Number.isFinite);
    if (!vals.length) return null;
    const value = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return Math.min(value, 2147483647); // clamp to INT4 max as a safety net
  };

  return {
    facebookLeadgenId: leadgenId || null,
    fullName: fullName || "Unknown",
    phone: find("phone", "phone_number", "mobile") ?? null,
    email: find("email") ?? null,
    postcode: find("postcode", "post_code", "zip") ?? null,
    age: toInt(ageRaw),
    propertyValue: toInt(propRaw),
    mortgageRemaining: toInt(mortRaw),
    urgency: find("urgency", "when", "timescale", "timeframe") ?? null,
    enquiryStage: find("stage", "researching", "status") ?? null,
    // "What do you need the money for?" — phrasing varies across lead forms.
    loanPurpose:
      find(
        "purpose",
        "reason",
        "money for",
        "funds for",
        "use the money",
        "use the funds",
        "looking to use",
        "what do you need",
        "spend"
      ) ?? null,
    rawPayload: (raw ?? flat) as object,
  };
}

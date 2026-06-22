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
  return normaliseFlat(flattenRaw(fb), fb.id, fb as unknown as object);
}

/**
 * Flatten either lead shape into a lower-cased key→value map:
 *   - Facebook's raw `{ field_data: [{ name, values }] }`
 *   - An already-flat `{ key: value }` object (Zapier's mapped shape)
 * Multi-select answers keep every value (joined) rather than dropping all but
 * the first. Shared by ingestion and the display helpers so both read answers
 * the same way.
 */
export function flattenRaw(raw: unknown): Record<string, string> {
  const flat: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return flat;
  const fieldData = (raw as { field_data?: unknown }).field_data;
  if (Array.isArray(fieldData)) {
    for (const f of fieldData as { name?: string; values?: unknown[] }[]) {
      if (!f?.name) continue;
      flat[String(f.name).toLowerCase().trim()] = (f.values ?? [])
        .map((v) => String(v).trim())
        .filter(Boolean)
        .join(", ");
    }
  } else {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v == null || typeof v === "object") continue;
      flat[k.toLowerCase().trim()] = String(v).trim();
    }
  }
  return flat;
}

/**
 * Find the first answer whose question key matches any of `keys`. Facebook
 * stores question keys with underscores (e.g. "property_value"); we normalise
 * those to spaces so space-worded search terms still match, case-insensitive.
 */
export function findField(flat: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    for (const name in flat) {
      if (name.replace(/_/g, " ").includes(k)) return flat[name];
    }
  }
  return undefined;
}

// Question-key search terms, shared by the numeric parser and the display
// helper so the value we score and the answer we show always come from the
// same field.
export const ANSWER_KEYS = {
  age: ["age"],
  property: ["property value", "house value", "home value", "property_value"],
  mortgage: ["mortgage", "outstanding"],
  title: ["title", "salutation", "mr/mrs", "gender", "sex"],
} as const;

/**
 * The customer's verbatim answers for the fields advisers care about, pulled
 * straight from the stored payload. We show these in the UI and notifications
 * instead of the midpoint integers — "£200,000 - £300,000" and "61-65" are the
 * real answers; collapsing them to a single number made every lead look like
 * templated demo data.
 */
export function leadDisplayAnswers(raw: unknown) {
  const flat = flattenRaw(raw);
  return {
    age: findField(flat, ...ANSWER_KEYS.age) ?? null,
    propertyValue: findField(flat, ...ANSWER_KEYS.property) ?? null,
    mortgage: findField(flat, ...ANSWER_KEYS.mortgage) ?? null,
    title: findField(flat, ...ANSWER_KEYS.title) ?? null,
  };
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
  const find = (...keys: string[]): string | undefined => findField(flat, ...keys);

  const fullName =
    find("full_name", "full name") ??
    `${find("first_name", "first name") ?? ""} ${find("last_name", "last name") ?? ""}`.trim();

  const ageRaw = find(...ANSWER_KEYS.age);
  const propRaw = find(...ANSWER_KEYS.property);
  const mortRaw = find(...ANSWER_KEYS.mortgage);

  const toInt = (s?: string) => {
    if (!s) return null;
    // Lead-form dropdowns send values as ranges with mixed notation, e.g.
    // "£300,000 – £400,000" or "£100k-£150k remaining". Drop thousands
    // separators, then read each number group together with any k/m suffix:
    // "100k" → 100,000, "1.2m" → 1,200,000. Missing this multiplier stored
    // "£100k" as 100, making mortgage values 1000× too small and corrupting
    // the quality score. A range yields >1 group → use the midpoint as the
    // representative value (matches the >= band thresholds in scoring.ts).
    const cleaned = s.replace(/,/g, "");
    // In ranges the suffix is often written once for both bounds, e.g.
    // "£150-£200k" means £150k–£200k. So if the answer contains a k-scaled
    // number, treat bare numbers under 1,000 in the same answer as thousands too.
    const hasK = /\d\s*k\b/i.test(cleaned);
    const vals: number[] = [];
    const re = /(\d+(?:\.\d+)?)\s*([km])?/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      let n = parseFloat(match[1]);
      const suffix = match[2]?.toLowerCase();
      if (suffix === "k") n *= 1_000;
      else if (suffix === "m") n *= 1_000_000;
      else if (hasK && n < 1_000) n *= 1_000;
      if (Number.isFinite(n)) vals.push(n);
    }
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

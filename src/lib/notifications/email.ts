import nodemailer, { type Transporter } from "nodemailer";

export type EmailResult = { ok: boolean; messageId?: string; error?: string };

let cached: Transporter | null | undefined;

function transporter(): Transporter | null {
  if (cached !== undefined) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cached = null;
    return cached;
  }
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user, pass },
  });
  return cached;
}

/** Parse a "Name <email>" string into its parts. */
function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || "LeadOS", email: m[2].trim() };
  return { name: "LeadOS", email: from.trim() };
}

/**
 * Send via Resend's transactional HTTP API (port 443).
 * Preferred provider. `from` must be an address on a domain verified in Resend
 * (e.g. "OS4ER Leads <leads@onestop4equityrelease.co.uk>").
 */
async function sendViaResend(
  apiKey: string,
  from: string,
  opts: { to: string; subject: string; text: string; html?: string }
): Promise<EmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.html ? { html: opts.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, messageId: data.id ?? "resend" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send via Brevo's transactional HTTP API (port 443).
 * Used in production because Railway blocks outbound SMTP ports.
 */
async function sendViaBrevo(
  apiKey: string,
  from: string,
  opts: { to: string; subject: string; text: string; html?: string }
): Promise<EmailResult> {
  const sender = parseFrom(from);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: opts.to }],
        subject: opts.subject,
        textContent: opts.text,
        ...(opts.html ? { htmlContent: opts.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Brevo ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { messageId?: string };
    return { ok: true, messageId: data.messageId ?? "brevo" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailResult> {
  // EMAIL_FROM lets prod send from a verified domain address without disturbing
  // the SMTP_FROM used by the local SMTP fallback. Falls back to SMTP_FROM.
  const from = process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? "LeadOS <noreply@example.com>";

  // Preferred path: Resend HTTP API (works on Railway, which blocks SMTP).
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    return sendViaResend(resendKey, from, opts);
  }

  // Legacy path: Brevo HTTP API. Kept as an automatic fallback during the
  // migration; remove BREVO_API_KEY once Resend is confirmed working.
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    return sendViaBrevo(brevoKey, from, opts);
  }

  // Fallback: SMTP (works locally where outbound SMTP isn't blocked).
  const t = transporter();
  if (!t) {
    console.warn("[email:stub] →", opts.to, "|", opts.subject);
    console.warn(opts.text);
    return { ok: true, messageId: "stub" };
  }
  try {
    const info = await t.sendMail({ from, ...opts });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

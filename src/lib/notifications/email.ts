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

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailResult> {
  const t = transporter();
  const from = process.env.SMTP_FROM ?? "LeadOS <noreply@example.com>";
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

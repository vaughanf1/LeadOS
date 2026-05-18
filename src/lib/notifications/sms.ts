import twilio from "twilio";

export type SmsResult = { ok: boolean; messageId?: string; error?: string };

let cached: ReturnType<typeof twilio> | null | undefined;

function client() {
  if (cached !== undefined) return cached;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    cached = null;
    return cached;
  }
  cached = twilio(sid, token);
  return cached;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const c = client();
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!c || !from) {
    console.warn("[sms:stub] →", to, body);
    return { ok: true, messageId: "stub" };
  }
  try {
    const msg = await c.messages.create({ to, from, body });
    return { ok: true, messageId: msg.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

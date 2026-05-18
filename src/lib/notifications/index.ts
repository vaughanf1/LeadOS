import type { Advisor, Lead } from "@prisma/client";
import { prisma } from "../prisma";
import { sendSms } from "./sms";
import { sendEmail } from "./email";
import { smsTemplate, emailTemplate } from "./templates";

export async function notifyAdvisor(lead: Lead, advisor: Advisor) {
  const wants = advisor.preferredDelivery;
  const results: { channel: "SMS" | "EMAIL"; ok: boolean; error?: string }[] = [];

  if ((wants === "SMS" || wants === "BOTH") && advisor.phone) {
    const body = smsTemplate(lead);
    const r = await sendSms(advisor.phone, body);
    await prisma.notificationLog.create({
      data: {
        leadId: lead.id,
        advisorId: advisor.id,
        channel: "SMS",
        status: r.ok ? "SENT" : "FAILED",
        to: advisor.phone,
        body,
        error: r.error,
        attempts: 1,
        sentAt: r.ok ? new Date() : null,
      },
    });
    results.push({ channel: "SMS", ok: r.ok, error: r.error });
  }

  if ((wants === "EMAIL" || wants === "BOTH") && advisor.email) {
    const { subject, text, html } = emailTemplate(lead, advisor);
    const r = await sendEmail({ to: advisor.email, subject, text, html });
    await prisma.notificationLog.create({
      data: {
        leadId: lead.id,
        advisorId: advisor.id,
        channel: "EMAIL",
        status: r.ok ? "SENT" : "FAILED",
        to: advisor.email,
        body: text,
        subject,
        error: r.error,
        attempts: 1,
        sentAt: r.ok ? new Date() : null,
      },
    });
    results.push({ channel: "EMAIL", ok: r.ok, error: r.error });
  }

  return results;
}

/** Send after-hours "Mode A" notifications: SMS Craig, email admin. */
export async function notifyAfterHoursAdmins(lead: Lead) {
  const craigPhone = process.env.CRAIG_PHONE;
  const adminEmail = process.env.ADMIN_EMAIL;
  const results: { channel: string; ok: boolean }[] = [];

  if (craigPhone) {
    const body = smsTemplate(lead);
    const r = await sendSms(craigPhone, body);
    await prisma.notificationLog.create({
      data: {
        leadId: lead.id,
        channel: "SMS",
        status: r.ok ? "SENT" : "FAILED",
        to: craigPhone,
        body,
        error: r.error,
        attempts: 1,
        sentAt: r.ok ? new Date() : null,
      },
    });
    results.push({ channel: "SMS:craig", ok: r.ok });
  }

  if (adminEmail) {
    const { subject, text, html } = emailTemplate(lead, null);
    const r = await sendEmail({ to: adminEmail, subject: `[After-hours] ${subject}`, text, html });
    await prisma.notificationLog.create({
      data: {
        leadId: lead.id,
        channel: "EMAIL",
        status: r.ok ? "SENT" : "FAILED",
        to: adminEmail,
        body: text,
        subject,
        error: r.error,
        attempts: 1,
        sentAt: r.ok ? new Date() : null,
      },
    });
    results.push({ channel: "EMAIL:admin", ok: r.ok });
  }

  return results;
}

/** Retry failed notifications (called by an admin button or future cron). */
export async function retryFailed(limit = 20) {
  const failed = await prisma.notificationLog.findMany({
    where: { status: "FAILED", attempts: { lt: 3 } },
    include: { lead: true, advisor: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  for (const n of failed) {
    let ok = false;
    let error: string | undefined;
    if (n.channel === "SMS") {
      const r = await sendSms(n.to, n.body);
      ok = r.ok;
      error = r.error;
    } else {
      const r = await sendEmail({
        to: n.to,
        subject: n.subject ?? "(no subject)",
        text: n.body,
      });
      ok = r.ok;
      error = r.error;
    }
    await prisma.notificationLog.update({
      where: { id: n.id },
      data: {
        status: ok ? "SENT" : "FAILED",
        attempts: { increment: 1 },
        sentAt: ok ? new Date() : null,
        error,
      },
    });
  }
  return { retried: failed.length };
}

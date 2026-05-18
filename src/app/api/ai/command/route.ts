import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseCommand } from "@/lib/ai/parser";
import { applyCommand, describeCommand, isDestructive, CommandSchema } from "@/lib/ai/commands";

export const runtime = "nodejs";

const ParseBody = z.object({ text: z.string().min(1).max(2000) });
const ApplyBody = z.object({ commandId: z.string() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsedBody = ParseBody.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  const result = await parseCommand(parsedBody.data.text);
  if (!result.ok) {
    const cmdRow = await prisma.adminCommand.create({
      data: { rawText: parsedBody.data.text, error: result.error },
    });
    return NextResponse.json({ ok: false, error: result.error, commandId: cmdRow.id });
  }

  const cmdRow = await prisma.adminCommand.create({
    data: {
      rawText: parsedBody.data.text,
      parsedAction: result.command as object,
    },
  });

  const description = await describeCommand(result.command);
  const destructive = isDestructive(result.command);

  if (!destructive) {
    // Read-only — execute straight away.
    const r = await applyCommand(result.command);
    await prisma.adminCommand.update({
      where: { id: cmdRow.id },
      data: { applied: true, appliedAt: new Date(), result: r.message },
    });
    return NextResponse.json({
      ok: true,
      commandId: cmdRow.id,
      description,
      destructive: false,
      result: r,
    });
  }

  // Destructive — return for confirmation.
  return NextResponse.json({
    ok: true,
    commandId: cmdRow.id,
    description,
    destructive: true,
    command: result.command,
  });
}

export async function PUT(req: Request) {
  // PUT = apply (confirm) a previously parsed destructive command.
  const body = await req.json().catch(() => ({}));
  const parsed = ApplyBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  const row = await prisma.adminCommand.findUnique({ where: { id: parsed.data.commandId } });
  if (!row || !row.parsedAction) {
    return NextResponse.json({ ok: false, error: "Command not found" }, { status: 404 });
  }
  if (row.applied) {
    return NextResponse.json({ ok: false, error: "Already applied" }, { status: 409 });
  }
  const cmd = CommandSchema.safeParse(row.parsedAction);
  if (!cmd.success) {
    return NextResponse.json({ ok: false, error: "Stored command invalid" }, { status: 400 });
  }
  const r = await applyCommand(cmd.data);
  await prisma.adminCommand.update({
    where: { id: row.id },
    data: { applied: r.ok, appliedAt: r.ok ? new Date() : null, result: r.message, error: r.ok ? null : r.message },
  });
  return NextResponse.json({ ok: r.ok, result: r });
}

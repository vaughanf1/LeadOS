import OpenAI from "openai";
import { CommandSchema, type Command } from "./commands";

const SYSTEM_PROMPT = `You are LeadOS, an admin assistant for a UK equity-release lead distribution app.
Your job is to convert the admin's natural language into ONE structured action by calling the
"submit_action" function. Never reply with prose — always call the function. If the admin's
request doesn't map to a supported action, choose the closest "query_*" action or ask via an
error in the action's text field.

Rules:
- Advisor names are case-insensitive partial matches; pass exactly what the admin typed.
- Times must be HH:mm 24-hour.
- Days-of-week are integers: 0=Sun, 1=Mon, …, 6=Sat.
- Today's date is ${new Date().toISOString().slice(0, 10)} (UK).
- For "tomorrow" / "Monday" etc, compute the actual ISO date.`;

const FUNCTION_DEF = {
  name: "submit_action",
  description: "Submit the structured admin action parsed from the user's request.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "pause_advisor",
          "resume_advisor",
          "set_daily_cap",
          "move_group",
          "set_status",
          "set_delivery",
          "set_schedule",
          "query_today_assignments",
          "query_unassigned_leads",
          "query_advisors",
          "send_next_leads_to",
        ],
      },
      advisorName: { type: "string" },
      advisorNames: { type: "array", items: { type: "string" } },
      pausedUntil: { type: "string", description: "ISO date YYYY-MM-DD; omit if no end date" },
      dailyLeadCap: { type: "integer", minimum: 0, maximum: 50 },
      group: { type: "string", enum: ["A", "B", "BACKEND"] },
      status: { type: "string", enum: ["ACTIVE", "PAUSED", "HOLIDAY", "FULL"] },
      delivery: { type: "string", enum: ["SMS", "EMAIL", "BOTH"] },
      days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
      startTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
      endTime: { type: "string", pattern: "^\\d{2}:\\d{2}$" },
      count: { type: "integer", minimum: 1, maximum: 20 },
    },
    required: ["action"],
  },
} as const;

export async function parseCommand(text: string): Promise<
  | { ok: true; command: Command }
  | { ok: false; error: string }
> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY not configured." };
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      tools: [{ type: "function", function: FUNCTION_DEF }],
      tool_choice: { type: "function", function: { name: "submit_action" } },
      temperature: 0.1,
    });

    const call = resp.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.function.name !== "submit_action") {
      return { ok: false, error: "AI did not return a structured action." };
    }
    const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
    const parsed = CommandSchema.safeParse(args);
    if (!parsed.success) {
      return {
        ok: false,
        error: `AI returned invalid action: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      };
    }
    return { ok: true, command: parsed.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

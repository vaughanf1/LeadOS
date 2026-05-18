"use client";

import { useState } from "react";
import { Bot, User, Loader2 } from "lucide-react";

type Msg =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | {
      kind: "confirm";
      commandId: string;
      description: string;
    }
  | { kind: "error"; text: string };

const EXAMPLES = [
  "Pause Kevin until Monday.",
  "Set Sonia's working hours to Monday to Thursday 10am to 1:30pm.",
  "Give Sarah 3 leads per day.",
  "Move Adrian to Group B.",
  "Who has received leads today?",
  "Show me unassigned leads.",
];

export function Chat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      kind: "assistant",
      text: "Hi — tell me what you'd like to change. I'll show a confirmation before applying anything.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(userText: string) {
    setMessages((m) => [...m, { kind: "user", text: userText }]);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: userText }),
      });
      const data = await res.json();
      if (!data.ok) {
        setMessages((m) => [...m, { kind: "error", text: data.error ?? "Something went wrong." }]);
      } else if (data.destructive) {
        setMessages((m) => [
          ...m,
          { kind: "confirm", commandId: data.commandId, description: data.description },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { kind: "assistant", text: data.result?.message ?? data.description ?? "Done." },
        ]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { kind: "error", text: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(commandId: string, description: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ai/command", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commandId }),
      });
      const data = await res.json();
      // Replace the confirm bubble with an outcome bubble
      setMessages((m) =>
        m
          .filter((msg) => !(msg.kind === "confirm" && msg.commandId === commandId))
          .concat([
            data.ok
              ? { kind: "assistant", text: data.result?.message ?? `Applied: ${description}` }
              : { kind: "error", text: data.error ?? data.result?.message ?? "Apply failed." },
          ])
      );
    } finally {
      setBusy(false);
    }
  }

  function cancel(commandId: string) {
    setMessages((m) =>
      m
        .filter((msg) => !(msg.kind === "confirm" && msg.commandId === commandId))
        .concat([{ kind: "assistant", text: "Okay, cancelled." }])
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-6">
      <div className="card flex flex-col h-[70vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <Bubble key={i} msg={m} onConfirm={confirm} onCancel={cancel} busy={busy} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-ink-muted text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !busy) send(text.trim());
          }}
          className="border-t border-line/60 p-3 flex gap-2"
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Pause Kevin until Monday"
            className="input flex-1"
            disabled={busy}
          />
          <button className="btn-primary" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="text-sm font-semibold">Try saying…</h2>
        </div>
        <ul className="p-3 space-y-1">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                onClick={() => send(ex)}
                disabled={busy}
                className="w-full text-left text-sm px-3 py-2 rounded-xl hover:bg-canvas-subtle text-ink-muted hover:text-ink transition"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Bubble({
  msg,
  onConfirm,
  onCancel,
  busy,
}: {
  msg: Msg;
  onConfirm: (id: string, desc: string) => void;
  onCancel: (id: string) => void;
  busy: boolean;
}) {
  if (msg.kind === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="bg-brand text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] shadow-soft">
          {msg.text}
        </div>
        <div className="h-7 w-7 rounded-full bg-canvas-subtle flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-ink-muted" />
        </div>
      </div>
    );
  }
  if (msg.kind === "error") {
    return (
      <div className="flex gap-3">
        <div className="h-7 w-7 rounded-full bg-danger/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-danger" />
        </div>
        <div className="bg-danger/5 border border-danger/20 text-danger rounded-2xl px-4 py-2.5 max-w-[80%]">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.kind === "confirm") {
    return (
      <div className="flex gap-3">
        <div className="h-7 w-7 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-warning" />
        </div>
        <div className="bg-warning/5 border border-warning/20 rounded-2xl px-4 py-3 max-w-[80%] space-y-2">
          <div className="text-sm">
            <strong>Confirm:</strong> {msg.description}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onConfirm(msg.commandId, msg.description)}
              disabled={busy}
              className="btn-primary text-xs px-3 py-1.5"
            >
              Apply
            </button>
            <button
              onClick={() => onCancel(msg.commandId)}
              disabled={busy}
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-brand" />
      </div>
      <div className="bg-canvas-subtle text-ink rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[80%] whitespace-pre-wrap">
        {msg.text}
      </div>
    </div>
  );
}

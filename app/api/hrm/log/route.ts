import { NextRequest, NextResponse } from "next/server";
import { logTicketsToHrm } from "@/lib/browser-hrm";
import type { HrmLogRequestBody, HrmStreamLine } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+$/;

export async function POST(request: NextRequest): Promise<Response> {
  let body: HrmLogRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tickets, dates } = body;

  if (!Array.isArray(tickets) || tickets.length === 0 || tickets.length > 5) {
    return NextResponse.json(
      { success: false, error: "Expected 1 to 5 tickets." },
      { status: 400 }
    );
  }

  for (const ticket of tickets) {
    if (!TICKET_PATTERN.test(ticket)) {
      return NextResponse.json(
        { success: false, error: `Invalid ticket format: ${ticket}. Expected MDP-XXXX.` },
        { status: 400 }
      );
    }
  }

  const dateObjs =
    dates && dates.length > 0
      ? dates.map((d) => new Date(`${d}T00:00:00`))
      : [undefined];

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const writeLine = (obj: HrmStreamLine) => {
    writer.write(encoder.encode(JSON.stringify(obj) + "\n"));
  };

  (async () => {
    try {
      for (const dateObj of dateObjs) {
        const result = await logTicketsToHrm(tickets, dateObj, (line) => {
          writeLine({ type: "log", data: line });
        });
        if (!result.success) {
          writeLine({ type: "result", success: false, error: result.error ?? "Unknown error" });
          return;
        }
      }
      writeLine({ type: "result", success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      writeLine({ type: "result", success: false, error: message });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

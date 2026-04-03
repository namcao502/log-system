import { NextRequest, NextResponse } from "next/server";
import { writeTicketViaPlaywright } from "@/lib/browser-log";
import type { LogRequestBody, LogStreamLine } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+(,\s*MDP-\d+)*$/;

export async function POST(request: NextRequest): Promise<Response> {
  let body: LogRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { ticket, dates } = body;

  if (!ticket || !TICKET_PATTERN.test(ticket)) {
    return NextResponse.json(
      { success: false, error: "Invalid ticket format. Expected MDP-XXXX." },
      { status: 400 }
    );
  }

  const dateObjs =
    dates && dates.length > 0
      ? dates.map((d) => new Date(`${d}T00:00:00`))
      : undefined;

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const writeLine = (obj: LogStreamLine) => {
    writer.write(encoder.encode(JSON.stringify(obj) + "\n"));
  };

  (async () => {
    try {
      const result = await writeTicketViaPlaywright(ticket, dateObjs, (line) => {
        writeLine({ type: "log", data: line });
      });
      writeLine(
        result.success
          ? { type: "result", success: true, cell: result.cell }
          : { type: "result", success: false, cell: result.cell, error: result.error ?? "Unknown error" }
      );
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

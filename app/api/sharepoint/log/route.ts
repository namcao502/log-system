import { NextRequest, NextResponse } from "next/server";
import { writeTicketViaPlaywright } from "@/lib/browser-log";
import type { LogRequestBody, LogResponse } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+(,\s*MDP-\d+)*$/;

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogResponse>> {
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

  const result = await writeTicketViaPlaywright(ticket, dateObjs);

  if (result.success) {
    return NextResponse.json({ success: true, cell: result.cell });
  } else {
    return NextResponse.json(
      { success: false, cell: result.cell, error: result.error },
      { status: 500 }
    );
  }
}

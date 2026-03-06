import { NextRequest, NextResponse } from "next/server";
import { writeTicketViaPlaywright } from "@/lib/browser-log";
import type { LogRequestBody, LogResponse } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+$/;

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

  const { ticket } = body;

  if (!ticket || !TICKET_PATTERN.test(ticket)) {
    return NextResponse.json(
      { success: false, error: "Invalid ticket format. Expected MDP-XXXX." },
      { status: 400 }
    );
  }

  const result = await writeTicketViaPlaywright(ticket);

  if (result.success) {
    return NextResponse.json({ success: true, cell: result.cell });
  } else {
    return NextResponse.json(
      { success: false, cell: result.cell, error: result.error },
      { status: 500 }
    );
  }
}

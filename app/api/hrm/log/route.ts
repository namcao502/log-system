import { NextRequest, NextResponse } from "next/server";
import { logTicketsToHrm } from "@/lib/browser-hrm";
import type { HrmLogRequestBody, HrmLogResponse } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+$/;

export async function POST(
  request: NextRequest
): Promise<NextResponse<HrmLogResponse>> {
  let body: HrmLogRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { tickets, date } = body;

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

  const dateObj = date ? new Date(`${date}T00:00:00`) : undefined;
  const result = await logTicketsToHrm(tickets, dateObj);

  if (result.success) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }
}

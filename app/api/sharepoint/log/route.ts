import { NextRequest, NextResponse } from "next/server";
import { writeTicketToExcel } from "@/lib/excel";
import { LogRequestBody, LogResponse } from "@/lib/types";

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
      {
        success: false,
        error: "Invalid ticket format. Expected MDP-XXXX.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await writeTicketToExcel(ticket);
    return NextResponse.json({ success: true, cell: result.cell });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyTicket } from "@/lib/jira";
import { JiraVerifyResponse } from "@/lib/types";

const TICKET_PATTERN = /^MDP-\d+$/;

export async function GET(
  request: NextRequest
): Promise<NextResponse<JiraVerifyResponse>> {
  const ticket = request.nextUrl.searchParams.get("ticket");

  if (!ticket || !TICKET_PATTERN.test(ticket)) {
    return NextResponse.json(
      { valid: false, error: "Invalid ticket format. Expected MDP-XXXX." },
      { status: 400 }
    );
  }

  try {
    const result = await verifyTicket(ticket);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { valid: false, error: message },
      { status: 500 }
    );
  }
}

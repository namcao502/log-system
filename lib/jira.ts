import { JiraVerifyResponse } from "./types";

export async function verifyTicket(
  ticketId: string
): Promise<JiraVerifyResponse> {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !token) {
    throw new Error("Missing Jira environment variables");
  }

  const url = `${baseUrl}/rest/api/3/issue/${ticketId}?fields=summary`;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (response.status === 200) {
    const data = await response.json();
    return { valid: true, summary: data.fields.summary };
  }

  if (response.status === 404) {
    return { valid: false };
  }

  throw new Error(`Jira API error: ${response.status} ${response.statusText}`);
}

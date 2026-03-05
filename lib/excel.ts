import { getAccessToken } from "./graph";

const WORKSHEET_NAME = "Daily Reports - 2026";

function getTodayFormatted(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();
  return `${month}/${day}/${year}`;
}

function buildWorksheetUrl(): string {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_DRIVE_ITEM_ID;

  if (!driveId || !itemId) {
    throw new Error("Missing SharePoint environment variables");
  }

  return `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(WORKSHEET_NAME)}')`;
}

async function graphRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

async function findDateRow(baseUrl: string, today: string): Promise<number> {
  const rangeUrl = `${baseUrl}/range(address='B:B')`;
  const response = await graphRequest(rangeUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to read column B: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const values: (string | null)[][] = data.values;

  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === today) {
      return i + 1; // 1-based row number
    }
  }

  throw new Error(`No row found for today's date: ${today}`);
}

async function readCell(baseUrl: string, cell: string): Promise<string> {
  const cellUrl = `${baseUrl}/range(address='${cell}')`;
  const response = await graphRequest(cellUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to read cell ${cell}: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  const value = data.values?.[0]?.[0];
  return value ? String(value) : "";
}

async function writeCell(
  baseUrl: string,
  cell: string,
  value: string
): Promise<void> {
  const cellUrl = `${baseUrl}/range(address='${cell}')`;
  const response = await graphRequest(cellUrl, {
    method: "PATCH",
    body: JSON.stringify({ values: [[value]] }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to write cell ${cell}: ${response.status} ${response.statusText}`
    );
  }
}

export async function writeTicketToExcel(
  ticket: string
): Promise<{ cell: string }> {
  const baseUrl = buildWorksheetUrl();
  const today = getTodayFormatted();

  const row = await findDateRow(baseUrl, today);
  const cell = `O${row}`;

  const existing = await readCell(baseUrl, cell);
  const newValue = existing ? `${existing}, ${ticket}` : ticket;

  await writeCell(baseUrl, cell, newValue);

  return { cell };
}

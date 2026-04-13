import { chromium, type BrowserContext, type Frame, type Page } from "playwright";
import path from "path";
import os from "os";

const EXCEL_URL =
  "https://tscmiami0-my.sharepoint.com/:x:/r/personal/dave_markert_tscmiami_com/_layouts/15/doc2.aspx?sourcedoc=%7B1AE62FA5-2E6F-47E6-B6B6-BFF724E1A08C%7D&file=TSC%20Development%20WIP.xlsx&action=default&mobileredirect=true";

const PLAYWRIGHT_PROFILE_DIR = path.join(os.homedir(), ".tsc-daily-log-browser");

const HEADER_ROWS = 2;
const TARGET_COLUMN = "M";

function getCellForDate(date: Date, emit: (line: string) => void): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);

  const dateUtc = Date.UTC(year, month - 1, day);
  const startUtc = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((dateUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;

  const row = HEADER_ROWS + dayOfYear;
  emit(`[browser-tsc] Date: ${year}-${month}-${day}, dayOfYear: ${dayOfYear}, row: ${row}`);
  return `${TARGET_COLUMN}${row}`;
}

async function getExcelFrame(page: Page, emit: (line: string) => void): Promise<Frame> {
  const iframeSelectors = [
    "#WacFrame_Excel_0",
    "iframe[id*='WacFrame']",
    "iframe[id*='Excel']",
    "iframe",
  ];

  for (const selector of iframeSelectors) {
    try {
      const iframeEl = await page.waitForSelector(selector, { timeout: 3000 });
      if (iframeEl) {
        const frame = await iframeEl.contentFrame();
        if (frame) {
          emit(`[browser-tsc] Found Excel iframe via: ${selector}`);
          return frame;
        }
      }
    } catch {
      continue;
    }
  }

  emit("[browser-tsc] No iframe found, using main page frame");
  return page.mainFrame();
}

async function navigateToCell(
  page: Page,
  frame: Frame,
  cellAddress: string,
  emit: (line: string) => void
): Promise<boolean> {
  const nameBox = frame.locator("[id*='NameBox'] input").first();
  try {
    await nameBox.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    emit("[browser-tsc] Name Box not found");
    return false;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    emit(`[browser-tsc] Nav attempt ${attempt} → ${cellAddress}`);

    await frame.evaluate(() => {
      const nb = document.querySelector("[id*='NameBox'] input") as HTMLInputElement;
      if (nb) {
        nb.focus();
        nb.select();
      }
    });
    await page.waitForTimeout(500);
    await page.keyboard.type(cellAddress, { delay: 50 });
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    const nbValue = (await nameBox.inputValue().catch(() => "")).trim().toUpperCase();
    emit(`[browser-tsc] Name Box after nav: "${nbValue}"`);

    if (nbValue === cellAddress.toUpperCase()) {
      emit(`[browser-tsc] Navigated to ${cellAddress}`);
      return true;
    }

    emit(`[browser-tsc] Expected "${cellAddress}", got "${nbValue}" — retrying`);
    await page.waitForTimeout(500);
  }

  emit(`[browser-tsc] Nav verification failed after 3 attempts`);
  return false;
}

const MAX_ATTEMPTS = 3;

async function attemptWrite(
  ticket: string,
  cellAddresses: string[],
  elapsed: () => string,
  emit: (line: string) => void
): Promise<{ success: boolean; cell: string; error?: string }> {
  let context: BrowserContext | null = null;
  const cellsLabel = cellAddresses.join(", ");

  try {
    context = await chromium.launchPersistentContext(PLAYWRIGHT_PROFILE_DIR, {
      channel: "msedge",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1280, height: 800 },
    });
    emit(`[browser-tsc] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(EXCEL_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    emit(`[browser-tsc] [${elapsed()}] DOM loaded`);

    const frame = await getExcelFrame(page, emit);
    emit(`[browser-tsc] [${elapsed()}] Iframe found`);

    try {
      await frame.waitForSelector("[id*='NameBox'] input", { timeout: 30000 });
      emit(`[browser-tsc] [${elapsed()}] Name Box visible`);
      await frame.waitForSelector("[id*='formulaBar'] [contenteditable]", { timeout: 10000 });
      emit(`[browser-tsc] [${elapsed()}] Formula bar visible`);
    } catch {
      emit(`[browser-tsc] [${elapsed()}] Excel UI not fully detected, continuing...`);
    }
    await page.waitForTimeout(3000);
    emit(`[browser-tsc] [${elapsed()}] Excel ready`);

    const formulaBar = frame.locator("[id*='formulaBar'] [contenteditable]").first();

    for (const cellAddress of cellAddresses) {
      const navSuccess = await navigateToCell(page, frame, cellAddress, emit);
      emit(`[browser-tsc] [${elapsed()}] Nav done → ${cellAddress}`);
      if (!navSuccess) {
        await context.close();
        return { success: false, cell: cellsLabel, error: `Could not navigate to target cell ${cellAddress}.` };
      }

      await formulaBar.click();
      await page.waitForTimeout(500);

      const currentValue = (await formulaBar.textContent())?.trim() ?? "";
      emit(`[browser-tsc] [${elapsed()}] ${cellAddress} value: "${currentValue}"`);

      if (currentValue.includes(ticket)) {
        emit(`[browser-tsc] [${elapsed()}] "${ticket}" already in ${cellAddress}, skipping`);
        await page.keyboard.press("Escape");
        continue;
      }

      const hasValidContent = currentValue && /MDP-\d+/.test(currentValue);
      const newValue = hasValidContent ? `${currentValue}, ${ticket}` : ticket;

      await formulaBar.press("Control+a");
      await page.waitForTimeout(300);
      await formulaBar.pressSequentially(newValue, { delay: 50 });
      await page.waitForTimeout(500);
      emit(`[browser-tsc] [${elapsed()}] Typed "${newValue}" into ${cellAddress}`);

      const fbAfter = (await formulaBar.textContent())?.trim() ?? "";
      emit(`[browser-tsc] Formula bar after typing: "${fbAfter}"`);

      await formulaBar.press("Enter");
      emit(`[browser-tsc] [${elapsed()}] Committed ${cellAddress}`);

      if (cellAddresses.indexOf(cellAddress) < cellAddresses.length - 1) {
        await page.waitForTimeout(1000);
      }
    }

    await page.waitForTimeout(3000);
    emit(`[browser-tsc] [${elapsed()}] Done!`);
    await context.close();

    return { success: true, cell: cellsLabel };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    emit(`[browser-tsc] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, cell: cellsLabel, error: message };
  }
}

export async function writeTicketViaPlaywright(
  ticket: string,
  dates?: Date[],
  onLog?: (line: string) => void
): Promise<{ success: boolean; cell: string; error?: string; logs: string[] }> {
  const effectiveDates = dates && dates.length > 0 ? dates : [new Date()];
  const logs: string[] = [];
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  const emit = (line: string) => {
    logs.push(line);
    onLog?.(line);
  };

  const cellAddresses = effectiveDates.map((d) => getCellForDate(d, emit));

  emit(`[browser-tsc] Target cells: ${cellAddresses.join(", ")}, ticket: ${ticket}`);

  const errors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      emit(`[browser-tsc] Retry attempt ${attempt}/${MAX_ATTEMPTS}`);
    }

    const result = await attemptWrite(ticket, cellAddresses, elapsed, emit);
    if (result.success) return { ...result, logs };

    const msg = result.error ?? "Unknown error";
    errors.push(`Attempt ${attempt}: ${msg}`);
    emit(`[browser-tsc] Attempt ${attempt} failed: ${msg}`);
  }

  return { success: false, cell: cellAddresses.join(", "), error: errors.join(" | "), logs };
}

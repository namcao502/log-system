import { chromium, type BrowserContext, type Frame, type Page } from "playwright";
import path from "path";
import os from "os";

const EXCEL_URL =
  "https://tscmiami0-my.sharepoint.com/:x:/r/personal/dave_markert_tscmiami_com/_layouts/15/doc2.aspx?sourcedoc=%7B1AE62FA5-2E6F-47E6-B6B6-BFF724E1A08C%7D&file=TSC%20Development%20WIP.xlsx&action=default&mobileredirect=true";

const PLAYWRIGHT_PROFILE_DIR = path.join(os.homedir(), ".tsc-daily-log-browser");

const HEADER_ROWS = 2;
const TARGET_COLUMN = "M";

function getCellForDate(date: Date): string {
  // Extract date parts in Vietnam timezone using Intl (no fragile string parsing)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);

  // Use UTC to avoid DST issues in diff calculation
  const dateUtc = Date.UTC(year, month - 1, day);
  const startUtc = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((dateUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;

  const row = HEADER_ROWS + dayOfYear;
  console.log(`[browser-log] Date: ${year}-${month}-${day}, dayOfYear: ${dayOfYear}, row: ${row}`);
  return `${TARGET_COLUMN}${row}`;
}

async function getExcelFrame(page: Page): Promise<Frame> {
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
          console.log(`[browser-log] Found Excel iframe via: ${selector}`);
          return frame;
        }
      }
    } catch {
      continue;
    }
  }

  console.log("[browser-log] No iframe found, using main page frame");
  return page.mainFrame();
}

async function navigateToCell(
  page: Page,
  frame: Frame,
  cellAddress: string
): Promise<boolean> {
  const nameBox = frame.locator("[id*='NameBox'] input").first();
  try {
    await nameBox.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    console.log("[browser-log] Name Box not found");
    return false;
  }

  // Try up to 3 times to navigate to the correct cell
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[browser-log] Nav attempt ${attempt} → ${cellAddress}`);

    // Focus Name Box and select its text via JS (locator.click doesn't reliably
    // transfer keyboard focus from the grid to the Name Box in Excel Online)
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

    // Verify Name Box shows correct cell after navigation
    const nbValue = (await nameBox.inputValue().catch(() => "")).trim().toUpperCase();
    console.log(`[browser-log] Name Box after nav: "${nbValue}"`);

    if (nbValue === cellAddress.toUpperCase()) {
      console.log(`[browser-log] Navigated to ${cellAddress}`);
      return true;
    }

    console.log(`[browser-log] Expected "${cellAddress}", got "${nbValue}" — retrying`);
    await page.waitForTimeout(500);
  }

  console.log(`[browser-log] Nav verification failed after 3 attempts`);
  return false;
}


export async function writeTicketViaPlaywright(
  ticket: string,
  date?: Date
): Promise<{ success: boolean; cell: string; error?: string }> {
  const cellAddress = getCellForDate(date ?? new Date());
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  console.log(`[browser-log] Target cell: ${cellAddress}, ticket: ${ticket}`);

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(PLAYWRIGHT_PROFILE_DIR, {
      channel: "msedge",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1280, height: 800 },
    });
    console.log(`[browser-log] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(EXCEL_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`[browser-log] [${elapsed()}] DOM loaded`);

    const frame = await getExcelFrame(page);
    console.log(`[browser-log] [${elapsed()}] Iframe found`);

    // Wait for Excel to fully load — Name Box AND formula bar must both be visible
    try {
      await frame.waitForSelector("[id*='NameBox'] input", { timeout: 30000 });
      console.log(`[browser-log] [${elapsed()}] Name Box visible`);
      await frame.waitForSelector("[id*='formulaBar'] [contenteditable]", { timeout: 10000 });
      console.log(`[browser-log] [${elapsed()}] Formula bar visible`);
    } catch {
      console.log(`[browser-log] [${elapsed()}] Excel UI not fully detected, continuing...`);
    }
    // Extra settle time for Excel to finish initializing
    await page.waitForTimeout(3000);
    console.log(`[browser-log] [${elapsed()}] Excel ready`);

    // 1. Navigate to cell
    const navSuccess = await navigateToCell(page, frame, cellAddress);
    console.log(`[browser-log] [${elapsed()}] Nav done`);
    if (!navSuccess) {
      await context.close();
      return { success: false, cell: cellAddress, error: "Could not navigate to target cell." };
    }

    // 2. Click formula bar to enter edit mode — use locator click to ensure
    //    the iframe receives focus, then all locator keyboard events target it.
    const formulaBar = frame.locator("[id*='formulaBar'] [contenteditable]").first();
    await formulaBar.click();
    await page.waitForTimeout(500);
    console.log(`[browser-log] [${elapsed()}] Formula bar clicked`);

    // 3. Read current cell value from formula bar
    const currentValue = (await formulaBar.textContent())?.trim() ?? "";
    console.log(`[browser-log] [${elapsed()}] Read value: "${currentValue}"`);

    // Skip if ticket is already in the cell
    if (currentValue.includes(ticket)) {
      console.log(`[browser-log] [${elapsed()}] "${ticket}" already in cell, skipping`);
      await page.keyboard.press("Escape");
      await context.close();
      return { success: true, cell: cellAddress };
    }

    // Append if current value contains a valid ticket pattern, otherwise replace
    const hasValidContent = currentValue && /MDP-\d+/.test(currentValue);
    const newValue = hasValidContent ? `${currentValue}, ${ticket}` : ticket;

    // 4. Select all in formula bar, type new value, commit — all via locator
    await formulaBar.press("Control+a");
    await page.waitForTimeout(300);
    await formulaBar.pressSequentially(newValue, { delay: 50 });
    await page.waitForTimeout(500);
    console.log(`[browser-log] [${elapsed()}] Typed "${newValue}"`);

    // Verify formula bar shows the correct value before committing
    const fbAfter = (await formulaBar.textContent())?.trim() ?? "";
    console.log(`[browser-log] Formula bar after typing: "${fbAfter}"`);

    await formulaBar.press("Enter");
    console.log(`[browser-log] [${elapsed()}] Committed`);

    // Wait for auto-save
    await page.waitForTimeout(3000);
    console.log(`[browser-log] [${elapsed()}] Done!`);
    await context.close();

    return { success: true, cell: cellAddress };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[browser-log] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, cell: cellAddress, error: message };
  }
}

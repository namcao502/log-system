import { chromium, type BrowserContext, type Page } from "playwright";
import path from "path";
import os from "os";

const HRM_URL = "https://hrm.nois.vn/timesheet/self-projects";
const HRM_PROFILE_DIR = path.join(os.homedir(), ".tsc-daily-log-hrm-browser");

function getTodayString(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

interface TimeSlot {
  start: string;
  end: string;
}

function getTimeSlots(ticketCount: number, ticketIndex: number): TimeSlot[] {
  if (ticketCount === 1) {
    // Single ticket gets both slots (8h total)
    return [
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ];
  }
  // Two tickets: first gets morning, second gets afternoon
  if (ticketIndex === 0) {
    return [{ start: "09:00", end: "12:00" }];
  }
  return [{ start: "13:00", end: "18:00" }];
}

async function waitForAngular(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
}

async function findTodayAddButton(page: Page, todayStr: string): Promise<boolean> {
  // NG-ZORRO structure: each day has a header div containing date text + "+ Thêm task" button
  // Structure: div.tw-bg-[#9ddaf7] > div.tw-flex > div.tw-w-[20%] > "Thứ Sáu - 06/03/2026" + button.ant-btn
  // The date and button are siblings inside the same tw-w-[20%] container

  // Strategy: find the container div that has BOTH the date text and the button
  const selector = `div.tw-w-\\[20\\%\\]:has-text("${todayStr}") button.ant-btn`;
  try {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      console.log(`[hrm-log] Clicked "+ Thêm task" for ${todayStr}`);
      return true;
    }
  } catch {
    console.log(`[hrm-log] Primary selector failed for ${todayStr}`);
  }

  // Fallback: use evaluate to find the button by matching date text in DOM
  console.log("[hrm-log] Trying JS fallback to find button...");
  const clicked = await page.evaluate((today) => {
    // Find all day header containers (tw-bg-* divs)
    const headers = document.querySelectorAll("div[class*='tw-bg']");
    for (const header of headers) {
      if (header.textContent?.includes(today)) {
        const btn = header.querySelector("button");
        if (btn) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  }, todayStr);

  if (clicked) {
    console.log(`[hrm-log] Clicked "+ Thêm task" via JS fallback`);
    return true;
  }

  console.log(`[hrm-log] Could not find "+ Thêm task" for ${todayStr}`);
  return false;
}

async function fillTaskPopup(
  page: Page,
  ticket: string,
  timeSlots: TimeSlot[]
): Promise<void> {
  // Wait for popup/dialog to appear
  await waitForAngular(page, 1500);

  // 1. Select "TSC Project" from Dự án dropdown (nz-select)
  console.log("[hrm-log] Selecting TSC Project...");

  // Click the Dự án nz-select to open it
  // NG-ZORRO renders nz-select as div.ant-select — need to click .ant-select-selector inside it
  let dropdownSelected = false;

  // Try clicking via JS to find the first nz-select in the modal and open it
  const opened = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal, .cdk-overlay-container");
    const root = modal || document;
    const selectors = root.querySelectorAll("nz-select .ant-select-selector, .ant-select-selector, nz-select");
    for (const el of selectors) {
      if (el instanceof HTMLElement) {
        el.click();
        return el.tagName + "." + (el.className || "").toString().slice(0, 50);
      }
    }
    return null;
  });

  if (opened) {
    console.log(`[hrm-log] Opened dropdown via JS: ${opened}`);
    await waitForAngular(page, 800);

    // Click "TSC Project" option — options render in cdk-overlay-container
    const optionSelectors = [
      "nz-option-item:has-text('TSC Project')",
      ".ant-select-item-option:has-text('TSC Project')",
      ".ant-select-item:has-text('TSC Project')",
      ".cdk-overlay-container :text('TSC Project')",
      "text=TSC Project",
    ];

    for (const optSel of optionSelectors) {
      try {
        const option = page.locator(optSel).first();
        if (await option.isVisible({ timeout: 2000 })) {
          await option.click();
          console.log(`[hrm-log] Selected TSC Project via: ${optSel}`);
          dropdownSelected = true;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!dropdownSelected) {
    console.log("[hrm-log] WARNING: Could not select TSC Project");
  }
  await waitForAngular(page, 500);

  // 2. Fill Task ID
  console.log(`[hrm-log] Filling Task ID: ${ticket}`);
  const taskIdSelectors = [
    "input[placeholder*='Task']",
    "input[formcontrolname*='task']",
    "input[formcontrolname*='taskId']",
    "xpath=//label[contains(text(),'Task ID')]/following::input[1]",
  ];

  for (const selector of taskIdSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.isVisible({ timeout: 1500 })) {
        await input.click();
        await input.fill(ticket);
        console.log(`[hrm-log] Filled Task ID via: ${selector}`);
        // Tab out to trigger Angular change detection
        await page.keyboard.press("Tab");
        break;
      }
    } catch {
      continue;
    }
  }

  // 3. Wait for system to load Tiêu đề Task and Loại Task
  console.log("[hrm-log] Waiting for task details to load...");
  await waitForAngular(page, 3000);

  // 4. Get the main task's "Loại task" value (e.g. "New Feature") to use in time rows
  const mainIssueType = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "";
    const input = modal.querySelector("input[formcontrolname='issueType']") as HTMLInputElement;
    return input?.value || "";
  });
  console.log(`[hrm-log] Main issue type: "${mainIssueType}"`);

  // 5. Add time entry rows and fill them
  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    console.log(`[hrm-log] Adding time slot ${i + 1}: ${slot.start} - ${slot.end}`);

    // Click + button (icon-only button with plus-circle icon)
    const plusClicked = await page.evaluate(() => {
      const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
      if (!modal) return false;
      const btn = modal.querySelector("button.ant-btn-icon-only:not([disabled])") as HTMLButtonElement;
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log(`[hrm-log] + button clicked: ${plusClicked}`);
    await waitForAngular(page, 1000);

    // Fill start/end time (last 2 hh:mm inputs belong to the newest row)
    const timeInputs = page.locator("input[placeholder='hh:mm']");
    const timeCount = await timeInputs.count();
    console.log(`[hrm-log] Found ${timeCount} time inputs`);

    if (timeCount >= 2) {
      const startInput = timeInputs.nth(timeCount - 2);
      const endInput = timeInputs.nth(timeCount - 1);

      await startInput.click();
      await startInput.fill(slot.start);
      await page.keyboard.press("Tab");
      await waitForAngular(page, 300);

      await endInput.click();
      await endInput.fill(slot.end);
      await page.keyboard.press("Tab");
      await waitForAngular(page, 500);

      console.log(`[hrm-log] Filled time: ${slot.start} - ${slot.end}`);
    }

    // Fill the "Loại task" field in this time entry row
    // Each time row has its own "Loại task" input with tw-h-[42px] tw-w-[150px]
    if (mainIssueType) {
      // Find all time-row "Loại task" inputs (they have tw-w-[150px] class, distinct from the main one)
      const filled = await page.evaluate((issueType) => {
        const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
        if (!modal) return "no modal";
        const inputs = modal.querySelectorAll("input[placeholder='Loại task']") as NodeListOf<HTMLInputElement>;
        // Find the last empty one (belongs to the newest time row)
        for (let j = inputs.length - 1; j >= 0; j--) {
          const input = inputs[j];
          // Skip the main form's issueType (it has formcontrolname='issueType')
          if (input.getAttribute("formcontrolname") === "issueType") continue;
          if (!input.value) {
            input.focus();
            input.click();
            return `focused index ${j}`;
          }
        }
        return "no empty input";
      }, mainIssueType);
      console.log(`[hrm-log] Loại task focus: ${filled}`);
      await waitForAngular(page, 300);

      // Type the issue type value and select from autocomplete
      const lastLoaiTask = page.locator("input[placeholder='Loại task']").last();
      await lastLoaiTask.fill(mainIssueType);
      await waitForAngular(page, 800);

      // Click the autocomplete option from the overlay
      const optionClicked = await page.evaluate((value) => {
        const overlay = document.querySelector(".cdk-overlay-container");
        if (!overlay) return "no overlay";
        const options = overlay.querySelectorAll("nz-auto-option, .ant-select-item-option, [nz-option-item], mat-option");
        for (const opt of options) {
          if (opt.textContent?.trim().includes(value) && opt instanceof HTMLElement) {
            opt.click();
            return `selected: "${opt.textContent.trim()}"`;
          }
        }
        // Fallback: click any visible autocomplete option
        for (const opt of options) {
          if (opt instanceof HTMLElement) {
            opt.click();
            return `selected fallback: "${opt.textContent?.trim()}"`;
          }
        }
        return "no option found";
      }, mainIssueType);
      console.log(`[hrm-log] Loại task autocomplete: ${optionClicked}`);

      if (optionClicked === "no option found") {
        // Try pressing Enter to confirm the typed value
        await page.keyboard.press("Enter");
        console.log("[hrm-log] Pressed Enter to confirm Loại task");
      }

      await waitForAngular(page, 500);
    }
  }

  // 6. Click "Lưu" to save (btn-save-and-close class)
  console.log("[hrm-log] Clicking Lưu...");
  await waitForAngular(page, 500);

  const saveResult = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "no modal";
    // Try btn-save-and-close first (the plain "Lưu" button)
    const saveBtn = modal.querySelector("button.btn-save-and-close") as HTMLButtonElement;
    if (saveBtn && !saveBtn.disabled) {
      saveBtn.click();
      return "clicked Lưu";
    }
    // Report disabled state
    if (saveBtn) return `Lưu is disabled`;
    return "Lưu button not found";
  });
  console.log(`[hrm-log] Save result: ${saveResult}`);

  await waitForAngular(page, 2000);
}

export async function logTicketsToHrm(
  tickets: string[]
): Promise<{ success: boolean; error?: string }> {
  const todayStr = getTodayString();
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  console.log(`[hrm-log] Tickets: ${tickets.join(", ")}, Date: ${todayStr}`);

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(HRM_PROFILE_DIR, {
      channel: "msedge",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1400, height: 900 },
    });
    console.log(`[hrm-log] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(HRM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`[hrm-log] [${elapsed()}] Page loaded`);

    // Wait for the Angular app to render the timesheet
    try {
      await page.waitForSelector("text=Timesheet", { timeout: 15000 });
      console.log(`[hrm-log] [${elapsed()}] Timesheet visible`);
    } catch {
      console.log(`[hrm-log] [${elapsed()}] Timesheet text not found, continuing...`);
    }
    await waitForAngular(page, 1000);

    // Process each ticket
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const slots = getTimeSlots(tickets.length, i);
      console.log(`[hrm-log] [${elapsed()}] Processing ticket ${i + 1}/${tickets.length}: ${ticket}`);

      // Find today's row and click "+ Thêm task"
      const found = await findTodayAddButton(page, todayStr);
      if (!found) {
        await context.close();
        return { success: false, error: `Could not find today's date (${todayStr}) or "+ Thêm task" button.` };
      }

      // Fill the popup
      await fillTaskPopup(page, ticket, slots);
      console.log(`[hrm-log] [${elapsed()}] Ticket ${ticket} saved`);
    }

    console.log(`[hrm-log] [${elapsed()}] Done!`);
    await context.close();

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[hrm-log] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, error: message };
  }
}

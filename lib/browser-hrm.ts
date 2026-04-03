import { chromium, type BrowserContext, type Page } from "playwright";
import path from "path";
import os from "os";
import { getTimeSlots, type TimeSlot } from "./time-slots";

const HRM_URL = "https://hrm.nois.vn/timesheet/self-projects";
const HRM_PROFILE_DIR = path.join(os.homedir(), ".tsc-daily-log-hrm-browser");

function getDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const dd = parts.find((p) => p.type === "day")!.value;
  const mm = parts.find((p) => p.type === "month")!.value;
  const yyyy = parts.find((p) => p.type === "year")!.value;
  return `${dd}/${mm}/${yyyy}`;
}

async function waitForAngular(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
}

async function findTodayAddButton(page: Page, todayStr: string, logs: string[]): Promise<boolean> {
  const selector = `div.tw-w-\\[20\\%\\]:has-text("${todayStr}") button.ant-btn`;
  try {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      logs.push(`[hrm-log] Clicked "+ Thêm task" for ${todayStr}`);
      return true;
    }
  } catch {
    logs.push(`[hrm-log] Primary selector failed for ${todayStr}`);
  }

  logs.push("[hrm-log] Trying JS fallback to find button...");
  const clicked = await page.evaluate((today) => {
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
    logs.push(`[hrm-log] Clicked "+ Thêm task" via JS fallback`);
    return true;
  }

  logs.push(`[hrm-log] Could not find "+ Thêm task" for ${todayStr}`);
  return false;
}

async function fillTaskPopup(
  page: Page,
  ticket: string,
  timeSlots: TimeSlot[],
  logs: string[]
): Promise<void> {
  await waitForAngular(page, 1500);

  logs.push("[hrm-log] Selecting TSC Project...");

  let dropdownSelected = false;

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
    logs.push(`[hrm-log] Opened dropdown via JS: ${opened}`);
    await waitForAngular(page, 800);

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
          logs.push(`[hrm-log] Selected TSC Project via: ${optSel}`);
          dropdownSelected = true;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!dropdownSelected) {
    logs.push("[hrm-log] WARNING: Could not select TSC Project");
  }
  await waitForAngular(page, 500);

  logs.push(`[hrm-log] Filling Task ID: ${ticket}`);
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
        logs.push(`[hrm-log] Filled Task ID via: ${selector}`);
        await page.keyboard.press("Tab");
        break;
      }
    } catch {
      continue;
    }
  }

  logs.push("[hrm-log] Waiting for task details to load...");
  await waitForAngular(page, 3000);

  const mainIssueType = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "";
    const input = modal.querySelector("input[formcontrolname='issueType']") as HTMLInputElement;
    return input?.value || "";
  });
  logs.push(`[hrm-log] Main issue type: "${mainIssueType}"`);

  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    logs.push(`[hrm-log] Adding time slot ${i + 1}: ${slot.start} - ${slot.end}`);

    const plusClicked = await page.evaluate(() => {
      const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
      if (!modal) return false;
      const btn = modal.querySelector("button.ant-btn-icon-only:not([disabled])") as HTMLButtonElement;
      if (btn) { btn.click(); return true; }
      return false;
    });
    logs.push(`[hrm-log] + button clicked: ${plusClicked}`);
    await waitForAngular(page, 1000);

    const timeInputs = page.locator("input[placeholder='hh:mm']");
    const timeCount = await timeInputs.count();
    logs.push(`[hrm-log] Found ${timeCount} time inputs`);

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

      logs.push(`[hrm-log] Filled time: ${slot.start} - ${slot.end}`);
    }

    if (mainIssueType) {
      const filled = await page.evaluate((issueType) => {
        const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
        if (!modal) return "no modal";
        const inputs = modal.querySelectorAll("input[placeholder='Loại task']") as NodeListOf<HTMLInputElement>;
        for (let j = inputs.length - 1; j >= 0; j--) {
          const input = inputs[j];
          if (input.getAttribute("formcontrolname") === "issueType") continue;
          if (!input.value) {
            input.focus();
            input.click();
            return `focused index ${j}`;
          }
        }
        return "no empty input";
      }, mainIssueType);
      logs.push(`[hrm-log] Loại task focus: ${filled}`);
      await waitForAngular(page, 300);

      const lastLoaiTask = page.locator("input[placeholder='Loại task']").last();
      await lastLoaiTask.fill(mainIssueType);
      await waitForAngular(page, 800);

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
        for (const opt of options) {
          if (opt instanceof HTMLElement) {
            opt.click();
            return `selected fallback: "${opt.textContent?.trim()}"`;
          }
        }
        return "no option found";
      }, mainIssueType);
      logs.push(`[hrm-log] Loại task autocomplete: ${optionClicked}`);

      if (optionClicked === "no option found") {
        await page.keyboard.press("Enter");
        logs.push("[hrm-log] Pressed Enter to confirm Loại task");
      }

      await waitForAngular(page, 500);
    }
  }

  logs.push("[hrm-log] Clicking Lưu...");
  await waitForAngular(page, 500);

  const saveResult = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "no modal";
    const saveBtn = modal.querySelector("button.btn-save-and-close") as HTMLButtonElement;
    if (saveBtn && !saveBtn.disabled) {
      saveBtn.click();
      return "clicked Lưu";
    }
    if (saveBtn) return `Lưu is disabled`;
    return "Lưu button not found";
  });
  logs.push(`[hrm-log] Save result: ${saveResult}`);

  await waitForAngular(page, 2000);
}

export async function logTicketsToHrm(
  tickets: string[],
  date?: Date
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const todayStr = getDateString(date ?? new Date());
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const logs: string[] = [];

  logs.push(`[hrm-log] Tickets: ${tickets.join(", ")}, Date: ${todayStr}`);

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(HRM_PROFILE_DIR, {
      channel: "msedge",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1400, height: 900 },
    });
    logs.push(`[hrm-log] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    await page.goto(HRM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    logs.push(`[hrm-log] [${elapsed()}] Page loaded`);

    try {
      await page.waitForSelector("text=Timesheet", { timeout: 15000 });
      logs.push(`[hrm-log] [${elapsed()}] Timesheet visible`);
    } catch {
      logs.push(`[hrm-log] [${elapsed()}] Timesheet text not found, continuing...`);
    }
    await waitForAngular(page, 1000);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const slots = getTimeSlots(tickets.length, i);
      logs.push(`[hrm-log] [${elapsed()}] Processing ticket ${i + 1}/${tickets.length}: ${ticket}`);

      const found = await findTodayAddButton(page, todayStr, logs);
      if (!found) {
        await context.close();
        return { success: false, error: `Could not find today's date (${todayStr}) or "+ Thêm task" button.`, logs };
      }

      await fillTaskPopup(page, ticket, slots, logs);
      logs.push(`[hrm-log] [${elapsed()}] Ticket ${ticket} saved`);
    }

    logs.push(`[hrm-log] [${elapsed()}] Done!`);
    await context.close();

    return { success: true, logs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logs.push(`[hrm-log] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, error: message, logs };
  }
}

import { chromium, type BrowserContext, type Page, type Frame } from "playwright";
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

/** Returns all date format variants the HRM page might display. */
function getDateVariants(date: Date): string[] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const dd = parts.find((p) => p.type === "day")!.value;   // "22"
  const mm = parts.find((p) => p.type === "month")!.value; // "04"
  const yyyy = parts.find((p) => p.type === "year")!.value;
  const d = String(parseInt(dd, 10));   // "22" (no change, but future-safe)
  const m = String(parseInt(mm, 10));   // "4"  (no leading zero)

  return [
    `${dd}/${mm}/${yyyy}`, // 22/04/2026
    `${d}/${m}/${yyyy}`,   // 22/4/2026
    `${dd}/${m}/${yyyy}`,  // 22/4/2026 mixed
    `${d}/${mm}/${yyyy}`,  // 22/04/2026 mixed
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe
}

async function waitForAngular(page: Page, ms = 1000): Promise<void> {
  await page.waitForTimeout(ms);
}

/**
 * Ensures the page is on the HRM timesheet. If MSAL redirected to Microsoft
 * login, waits up to 2 minutes for the user to authenticate, then navigates
 * back to the timesheet and confirms it loaded.
 * Returns an error string if auth timed out, null on success.
 */
async function ensureAuthenticated(
  page: Page,
  emit: (line: string) => void,
  elapsed: () => string,
): Promise<string | null> {
  await page.goto(HRM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  emit(`[hrm-log] [${elapsed()}] Page loaded: ${page.url()}`);

  // Wait for MSAL.js to fire its client-side redirect (if session expired)
  await waitForAngular(page, 2000);

  const onHrm = () => page.url().includes("hrm.nois.vn") && !page.url().includes("/login");

  if (!onHrm()) {
    emit(`[hrm-log] [${elapsed()}] Session expired -- please log in in the browser window that just opened...`);
    try {
      await page.waitForURL(
        (url) =>
          url.hostname === "hrm.nois.vn" &&
          !url.pathname.toLowerCase().includes("login") &&
          !url.pathname.toLowerCase().includes("auth"),
        { timeout: 120_000 },
      );
    } catch {
      return "Timed out waiting for HRM login. Please log in within 2 minutes and try again.";
    }
    emit(`[hrm-log] [${elapsed()}] Login complete -- navigating to timesheet...`);
    // OAuth redirects to hrm.nois.vn/ (root); go to the actual timesheet page
    await page.goto(HRM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitForAngular(page, 3000);
  }

  try {
    await page.waitForSelector("text=Timesheet", { timeout: 15000 });
    emit(`[hrm-log] [${elapsed()}] Timesheet ready`);
  } catch {
    emit(`[hrm-log] [${elapsed()}] Timesheet selector not found, continuing...`);
  }

  return null;
}

async function searchFrameForButton(
  frame: Frame,
  dateVariants: string[],
): Promise<{ clicked: boolean; variant: string | null; frameName: string; diag: string[] }> {
  const frameName = frame.name() || frame.url();
  return frame.evaluate(
    ([variants, fname]) => {
      const allText: string[] = [];
      document.querySelectorAll("div, span, td, th").forEach((el) => {
        const t = el.textContent?.trim() ?? "";
        if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(t) && t.length < 80) allText.push(t);
      });

      for (const variant of variants) {
        // Use TreeWalker to find the actual text node rendering the date.
        // This avoids ancestor elements that contain multiple date columns.
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let textNode: Node | null;
        while ((textNode = walker.nextNode())) {
          if (!textNode.textContent?.includes(variant)) continue;

          // Start from the element containing this text node and walk up,
          // stopping as soon as we find a container that has a button.
          // Limit depth so we don't escape the day column into a shared parent.
          let node: Element | null = (textNode as Text).parentElement;
          for (let depth = 0; depth < 6; depth++) {
            if (!node) break;
            const btn = node.querySelector("button");
            if (btn instanceof HTMLButtonElement && !btn.disabled) {
              btn.click();
              return { clicked: true, variant, frameName: fname, diag: allText.slice(0, 10) };
            }
            node = node.parentElement;
          }
        }
      }
      return { clicked: false, variant: null, frameName: fname, diag: allText.slice(0, 10) };
    },
    [dateVariants, frameName] as [string[], string],
  );
}

async function findTodayAddButton(page: Page, todayStr: string, emit: (line: string) => void, dateVariants: string[]): Promise<boolean> {
  const frames = page.frames();
  emit(`[hrm-log] Searching ${frames.length} frame(s) for date button...`);

  for (const frame of frames) {
    // Playwright locator: scope button to the same container as the date text
    for (const variant of dateVariants) {
      try {
        // Find the most specific element containing the date text that also has a button inside it
        const container = frame.locator(`div:has-text("${variant}")`).filter({
          has: frame.locator("button"),
        }).last();
        if (await container.isVisible({ timeout: 1500 }).catch(() => false)) {
          await container.locator("button").first().click();
          emit(`[hrm-log] Clicked "+ Thêm task" for ${variant} via Playwright`);
          return true;
        }
      } catch {
        // continue to JS fallback
      }
    }

    // JS fallback using TreeWalker for precise text node location
    try {
      const result = await searchFrameForButton(frame, dateVariants);
      emit(`[hrm-log] Frame date texts: ${result.diag.join(" | ") || "(none)"}`);
      if (result.clicked) {
        emit(`[hrm-log] Clicked "+ Thêm task" via JS (variant: ${result.variant})`);
        return true;
      }
    } catch {
      // frame navigated away; skip
    }
  }

  emit(`[hrm-log] Could not find "+ Thêm task" for ${todayStr}`);
  return false;
}

async function fillTaskPopup(
  page: Page,
  ticket: string,
  timeSlots: TimeSlot[],
  emit: (line: string) => void
): Promise<void> {
  await waitForAngular(page, 1500);

  emit("[hrm-log] Selecting TSC Project...");

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
    emit(`[hrm-log] Opened dropdown via JS: ${opened}`);
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
          emit(`[hrm-log] Selected TSC Project via: ${optSel}`);
          dropdownSelected = true;
          break;
        }
      } catch {
        continue;
      }
    }
  }

  if (!dropdownSelected) {
    emit("[hrm-log] WARNING: Could not select TSC Project");
  }
  await waitForAngular(page, 500);

  emit(`[hrm-log] Filling Task ID: ${ticket}`);
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
        emit(`[hrm-log] Filled Task ID via: ${selector}`);
        await page.keyboard.press("Tab");
        break;
      }
    } catch {
      continue;
    }
  }

  emit("[hrm-log] Waiting for task details to load...");
  await waitForAngular(page, 3000);

  const mainIssueType = await page.evaluate(() => {
    const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
    if (!modal) return "";
    const input = modal.querySelector("input[formcontrolname='issueType']") as HTMLInputElement;
    return input?.value || "";
  });
  emit(`[hrm-log] Main issue type: "${mainIssueType}"`);

  for (let i = 0; i < timeSlots.length; i++) {
    const slot = timeSlots[i];
    emit(`[hrm-log] Adding time slot ${i + 1}: ${slot.start} - ${slot.end}`);

    const plusClicked = await page.evaluate(() => {
      const modal = document.querySelector("nz-modal-container, .ant-modal-wrap, .cdk-overlay-container");
      if (!modal) return false;
      const btn = modal.querySelector("button.ant-btn-icon-only:not([disabled])") as HTMLButtonElement;
      if (btn) { btn.click(); return true; }
      return false;
    });
    emit(`[hrm-log] + button clicked: ${plusClicked}`);
    await waitForAngular(page, 1000);

    const timeInputs = page.locator("input[placeholder='hh:mm']");
    const timeCount = await timeInputs.count();
    emit(`[hrm-log] Found ${timeCount} time inputs`);

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

      emit(`[hrm-log] Filled time: ${slot.start} - ${slot.end}`);
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
      emit(`[hrm-log] Loại task focus: ${filled}`);
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
      emit(`[hrm-log] Loại task autocomplete: ${optionClicked}`);

      if (optionClicked === "no option found") {
        await page.keyboard.press("Enter");
        emit("[hrm-log] Pressed Enter to confirm Loại task");
      }

      await waitForAngular(page, 500);
    }
  }

  emit("[hrm-log] Clicking Lưu...");
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
  emit(`[hrm-log] Save result: ${saveResult}`);

  await waitForAngular(page, 2000);
}

export async function logTicketsToHrm(
  tickets: string[],
  date?: Date,
  onLog?: (line: string) => void
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const todayStr = getDateString(date ?? new Date());
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
  const logs: string[] = [];

  const emit = (line: string) => {
    logs.push(line);
    onLog?.(line);
  };

  const dateVariants = getDateVariants(date ?? new Date());
  emit(`[hrm-log] Tickets: ${tickets.join(", ")}, Date: ${todayStr} (variants: ${dateVariants.join(", ")})`);

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(HRM_PROFILE_DIR, {
      channel: "chrome",
      headless: false,
      args: ["--disable-blink-features=AutomationControlled"],
      viewport: { width: 1400, height: 900 },
    });
    emit(`[hrm-log] [${elapsed()}] Browser launched`);

    const page = context.pages()[0] || (await context.newPage());

    const authError = await ensureAuthenticated(page, emit, elapsed);
    if (authError) {
      await context.close();
      return { success: false, error: authError, logs };
    }
    await waitForAngular(page, 1000);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const slots = getTimeSlots(tickets.length, i);
      emit(`[hrm-log] [${elapsed()}] Processing ticket ${i + 1}/${tickets.length}: ${ticket}`);

      const found = await findTodayAddButton(page, todayStr, emit, dateVariants);
      if (!found) {
        await context.close();
        return { success: false, error: `Could not find today's date (${todayStr}) or "+ Thêm task" button.`, logs };
      }

      await fillTaskPopup(page, ticket, slots, emit);
      emit(`[hrm-log] [${elapsed()}] Ticket ${ticket} saved`);
    }

    emit(`[hrm-log] [${elapsed()}] Done!`);
    await context.close();

    return { success: true, logs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    emit(`[hrm-log] [${elapsed()}] Error: ${message}`);
    if (context) {
      try { await context.close(); } catch { /* ignore */ }
    }
    return { success: false, error: message, logs };
  }
}

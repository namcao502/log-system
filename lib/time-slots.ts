export interface TimeSlot {
  start: string;
  end: string;
}

const MORNING_START = 9 * 60;    // 09:00 = 540
const MORNING_END = 12 * 60;     // 12:00 = 720
const AFTERNOON_START = 13 * 60; // 13:00 = 780
const AFTERNOON_END = 18 * 60;   // 18:00 = 1080
const TOTAL_WORK_MINUTES = (MORNING_END - MORNING_START) + (AFTERNOON_END - AFTERNOON_START); // 480

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function roundTo5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

/** Convert a work-minute offset (0–480) to an absolute clock minute (540–1080). */
function workOffsetToClock(offset: number): number {
  if (offset <= MORNING_END - MORNING_START) {
    return MORNING_START + offset;
  }
  return AFTERNOON_START + (offset - (MORNING_END - MORNING_START));
}

export function getTimeSlots(ticketCount: number, ticketIndex: number): TimeSlot[] {
  const perTicket = Math.floor(TOTAL_WORK_MINUTES / ticketCount);
  const isLast = ticketIndex === ticketCount - 1;
  const startOffset = perTicket * ticketIndex;
  const endOffset = isLast ? TOTAL_WORK_MINUTES : perTicket * (ticketIndex + 1);

  const clockStart = roundTo5(workOffsetToClock(startOffset));
  const clockEnd = roundTo5(workOffsetToClock(endOffset));

  if (clockStart < MORNING_END && clockEnd > AFTERNOON_START) {
    return [
      { start: minutesToTime(clockStart), end: minutesToTime(MORNING_END) },
      { start: minutesToTime(AFTERNOON_START), end: minutesToTime(clockEnd) },
    ];
  }

  if (clockStart < MORNING_END && clockEnd > MORNING_END && clockEnd <= AFTERNOON_START) {
    return [{ start: minutesToTime(clockStart), end: minutesToTime(MORNING_END) }];
  }

  return [{ start: minutesToTime(clockStart), end: minutesToTime(clockEnd) }];
}

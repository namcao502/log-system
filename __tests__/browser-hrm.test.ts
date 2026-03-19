import { getTimeSlots } from "@/lib/time-slots";

function totalMinutes(slots: { start: string; end: string }[]): number {
  return slots.reduce((sum, s) => {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
}

describe("getTimeSlots", () => {
  // 1 ticket: full day (09:00-12:00, 13:00-18:00)
  it("returns full day for 1 ticket", () => {
    const slots = getTimeSlots(1, 0);
    expect(slots).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "18:00" },
    ]);
    expect(totalMinutes(slots)).toBe(480);
  });

  // 2 tickets: 240 min each
  it("splits 2 tickets evenly", () => {
    const t0 = getTimeSlots(2, 0);
    const t1 = getTimeSlots(2, 1);

    expect(totalMinutes(t0)).toBe(240);
    expect(totalMinutes(t1)).toBe(240);

    // First ticket crosses lunch: 09:00-12:00 + 13:00-14:00
    expect(t0).toEqual([
      { start: "09:00", end: "12:00" },
      { start: "13:00", end: "14:00" },
    ]);
    // Second ticket: 14:00-18:00
    expect(t1).toEqual([{ start: "14:00", end: "18:00" }]);
  });

  // 3 tickets: 160 min each
  it("splits 3 tickets evenly", () => {
    const all = [0, 1, 2].map((i) => getTimeSlots(3, i));
    const durations = all.map(totalMinutes);

    expect(durations[0]).toBe(160);
    expect(durations[1]).toBe(160);
    expect(durations[2]).toBe(160);

    // Total must be 480
    expect(durations.reduce((a, b) => a + b, 0)).toBe(480);
  });

  // 4 tickets: 120 min each
  it("splits 4 tickets evenly", () => {
    const all = [0, 1, 2, 3].map((i) => getTimeSlots(4, i));
    const durations = all.map(totalMinutes);

    durations.forEach((d) => expect(d).toBe(120));
    expect(durations.reduce((a, b) => a + b, 0)).toBe(480);
  });

  // 5 tickets: ~96 min each (rounding to 5-min boundaries may shift slightly)
  it("splits 5 tickets approximately evenly", () => {
    const all = [0, 1, 2, 3, 4].map((i) => getTimeSlots(5, i));
    const durations = all.map(totalMinutes);

    // Total must cover the full workday
    expect(durations.reduce((a, b) => a + b, 0)).toBe(480);
    // Each ticket should be approximately 96 min (within rounding tolerance)
    durations.forEach((d) => {
      expect(d).toBeGreaterThanOrEqual(90);
      expect(d).toBeLessThanOrEqual(105);
    });
  });

  // Lunch-break splitting: ticket that spans 12:00-13:00 must be split
  it("splits a slot that crosses the lunch break into two rows", () => {
    // With 2 tickets, ticket 0 gets 240 min starting at 09:00
    // That's 09:00 → 13:00 work time = must split at lunch
    const slots = getTimeSlots(2, 0);
    expect(slots.length).toBe(2);
    expect(slots[0].end).toBe("12:00");
    expect(slots[1].start).toBe("13:00");
  });

  // 5-minute rounding
  it("rounds times to 5-minute boundaries", () => {
    for (let count = 1; count <= 5; count++) {
      for (let idx = 0; idx < count; idx++) {
        const slots = getTimeSlots(count, idx);
        for (const slot of slots) {
          const [, sm] = slot.start.split(":").map(Number);
          const [, em] = slot.end.split(":").map(Number);
          expect(sm % 5).toBe(0);
          expect(em % 5).toBe(0);
        }
      }
    }
  });

  // No gaps: tickets should cover the entire workday contiguously
  it("covers the full workday with no gaps for 3 tickets", () => {
    const all = [0, 1, 2].map((i) => getTimeSlots(3, i));
    const flatSlots = all.flat();

    // First slot starts at 09:00
    expect(flatSlots[0].start).toBe("09:00");
    // Last slot ends at 18:00
    expect(flatSlots[flatSlots.length - 1].end).toBe("18:00");

    // Check contiguity (allowing 12:00→13:00 lunch gap)
    for (let i = 1; i < flatSlots.length; i++) {
      const prevEnd = flatSlots[i - 1].end;
      const currStart = flatSlots[i].start;
      if (prevEnd === "12:00") {
        expect(currStart).toBe("13:00");
      } else {
        expect(currStart).toBe(prevEnd);
      }
    }
  });
});

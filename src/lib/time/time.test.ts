import { describe, expect, it } from "vitest";
import {
  formatOffset,
  instantFromWallClock,
  isoDate,
  offsetMinutes,
  zoneCity,
  zonedParts,
} from "./zones";
import {
  buildRangeSlots,
  buildSlots,
  describeSlot,
  evaluateSlot,
  rankSlots,
  shiftDate,
  type Participant,
} from "./slots";
import { toIcs } from "./ics";
import { decodeState, encodeState } from "@/lib/share";

const madrid = "Europe/Madrid";
const newYork = "America/New_York";
const kolkata = "Asia/Kolkata";

describe("offsetMinutes", () => {
  it("tracks daylight saving in both hemispheres", () => {
    const january = new Date("2026-01-15T12:00:00Z");
    const july = new Date("2026-07-15T12:00:00Z");

    expect(offsetMinutes(newYork, january)).toBe(-300); // EST
    expect(offsetMinutes(newYork, july)).toBe(-240); // EDT
    expect(offsetMinutes(madrid, january)).toBe(60);
    expect(offsetMinutes(madrid, july)).toBe(120);
    expect(offsetMinutes("Australia/Sydney", july)).toBe(600); // southern winter
  });

  it("ignores seconds on the instant", () => {
    const withSeconds = new Date("2026-01-15T12:34:56.789Z");
    expect(offsetMinutes(newYork, withSeconds)).toBe(-300);
    expect(offsetMinutes(madrid, withSeconds)).toBe(60);
    expect(offsetMinutes(kolkata, withSeconds)).toBe(330);
  });

  it("handles half-hour zones", () => {
    expect(offsetMinutes(kolkata, new Date("2026-06-01T00:00:00Z"))).toBe(330);
    expect(formatOffset(330)).toBe("UTC+5:30");
    expect(formatOffset(-300)).toBe("UTC−5");
    expect(formatOffset(0)).toBe("UTC");
  });
});

describe("instantFromWallClock", () => {
  it("round-trips a wall clock time through its instant", () => {
    const wall = { year: 2026, month: 11, day: 3, hour: 9, minute: 30 };
    const instant = instantFromWallClock(newYork, wall);
    expect(zonedParts(newYork, instant)).toMatchObject({ hour: 9, minute: 30, day: 3 });
  });

  it("resolves times on the day the clocks go forward", () => {
    // US DST starts 2026-03-08; 03:00 local exists, 02:30 does not.
    const three = instantFromWallClock(newYork, {
      year: 2026,
      month: 3,
      day: 8,
      hour: 3,
      minute: 0,
    });
    expect(zonedParts(newYork, three)).toMatchObject({ hour: 3, minute: 0, day: 8 });
    expect(offsetMinutes(newYork, three)).toBe(-240);
  });

  it("resolves times on the day the clocks go back", () => {
    const instant = instantFromWallClock(newYork, {
      year: 2026,
      month: 11,
      day: 1,
      hour: 12,
      minute: 0,
    });
    expect(zonedParts(newYork, instant)).toMatchObject({ hour: 12, day: 1 });
  });
});

describe("isoDate", () => {
  it("reports the local date, not the UTC one", () => {
    const instant = new Date("2026-08-18T23:30:00Z");
    expect(isoDate("UTC", instant)).toBe("2026-08-18");
    expect(isoDate("Asia/Tokyo", instant)).toBe("2026-08-19");
    expect(isoDate("America/Los_Angeles", instant)).toBe("2026-08-18");
  });
});

const team: Participant[] = [
  { id: "a", name: "Ana", timeZone: madrid, dayStart: 9, dayEnd: 18 },
  { id: "b", name: "Ben", timeZone: newYork, dayStart: 9, dayEnd: 17 },
  { id: "c", name: "Chen", timeZone: kolkata, dayStart: 10, dayEnd: 19 },
];

describe("evaluateSlot", () => {
  const options = {
    date: "2026-08-18",
    organiserZone: "UTC",
    durationMinutes: 30,
    participants: team,
  };

  it("converts one instant into each participant's local time", () => {
    const slot = evaluateSlot(Date.parse("2026-08-18T13:00:00Z"), options);
    expect(slot.entries.map((e) => e.label)).toEqual(["15:00", "09:00", "18:30"]);
    expect(slot.entries.every((e) => e.quality === "core")).toBe(true);
    expect(slot.fairness).toBe(1);
  });

  it("marks a slot outside working hours", () => {
    const slot = evaluateSlot(Date.parse("2026-08-18T02:00:00Z"), options);
    expect(slot.fairness).toBe(0);
    expect(slot.entries[1]?.quality).toBe("outside");
  });

  it("records the day rolling over for eastern participants", () => {
    const slot = evaluateSlot(Date.parse("2026-08-18T20:00:00Z"), options);
    const chen = slot.entries.find((e) => e.participantId === "c");
    expect(chen?.dayOffset).toBe(1);
    expect(chen?.label).toBe("01:30");
  });

  it("judges a slot by its end as well as its start", () => {
    // 13:30Z is inside everyone's day; three hours later Chen is at 22:00.
    const start = Date.parse("2026-08-18T13:30:00Z");
    const short = evaluateSlot(start, { ...options, durationMinutes: 15 });
    const long = evaluateSlot(start, { ...options, durationMinutes: 180 });
    expect(short.fairness).toBeGreaterThan(long.fairness);
    expect(long.entries.find((e) => e.participantId === "c")?.quality).toBe("outside");
  });

  it("treats weekends as outside working hours", () => {
    const saturday = evaluateSlot(Date.parse("2026-08-22T13:00:00Z"), {
      ...options,
      date: "2026-08-22",
    });
    expect(saturday.score).toBe(0);
  });
});

describe("buildSlots and rankSlots", () => {
  const options = {
    date: "2026-08-18",
    organiserZone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    participants: team,
  };

  it("covers the organiser's day at the requested granularity", () => {
    const slots = buildSlots(options);
    expect(slots).toHaveLength(48);
    expect(isoDate("UTC", new Date(slots[0]!.startUtc))).toBe("2026-08-18");
  });

  it("prefers the slot nobody has to suffer for", () => {
    const [best] = rankSlots(buildSlots(options));
    expect(best?.fairness).toBe(1);
    expect(best?.entries.every((entry) => entry.quality === "core")).toBe(true);
  });

  it("keeps suggestions at least an hour apart", () => {
    const ranked = rankSlots(buildSlots(options), 5);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i]!.startUtc - ranked[i - 1]!.startUtc).not.toBe(0);
      const gaps = ranked.map((slot) => slot.startUtc);
      const distinct = gaps.every((value, index) =>
        gaps.every((other, otherIndex) => index === otherIndex || Math.abs(value - other) >= 3_600_000),
      );
      expect(distinct).toBe(true);
    }
  });

  it("returns nothing when there are no participants", () => {
    expect(buildSlots({ ...options, participants: [] })).toEqual([]);
  });
});

describe("describeSlot", () => {
  it("writes a summary with each person's own time", () => {
    const slot = evaluateSlot(Date.parse("2026-08-18T13:00:00Z"), {
      date: "2026-08-18",
      organiserZone: "UTC",
      durationMinutes: 30,
      participants: team,
    });
    const text = describeSlot(slot, team, "UTC");
    expect(text).toContain("Tue 18/8");
    expect(text).toContain("Ana — 15:00");
    expect(text).toContain("Chen — 18:30");
  });
});

describe("zoneCity", () => {
  it("reads the city out of an IANA identifier", () => {
    expect(zoneCity("Europe/Madrid")).toBe("Madrid");
    expect(zoneCity("America/Argentina/Salta")).toBe("Salta");
    expect(zoneCity("Asia/Ho_Chi_Minh")).toBe("Ho Chi Minh");
  });
});

describe("buildRangeSlots", () => {
  const base = {
    date: "2026-08-18",
    organiserZone: "UTC",
    durationMinutes: 30,
    stepMinutes: 60,
    participants: team,
  };

  it("covers every day in the range", () => {
    const slots = buildRangeSlots(base, 7);
    expect(slots).toHaveLength(24 * 7);
    const days = new Set(slots.map((slot) => isoDate("UTC", new Date(slot.startUtc))));
    expect(days.size).toBe(7);
    expect(days.has("2026-08-24")).toBe(true);
  });

  it("finds a workable time later in the week when today has none", () => {
    // A Saturday: nothing works, but the following Monday does.
    const weekend = { ...base, date: "2026-08-22" };
    expect(rankSlots(buildSlots(weekend))[0]?.fairness).toBe(0);

    const [best] = rankSlots(buildRangeSlots(weekend, 7));
    expect(best?.fairness).toBe(1);
    expect(isoDate("UTC", new Date(best!.startUtc))).toBe("2026-08-24"); // Monday
  });

  it("shifts dates across a month boundary", () => {
    expect(shiftDate("2026-08-30", 3)).toBe("2026-09-02");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("toIcs", () => {
  const slot = evaluateSlot(Date.parse("2026-08-18T13:00:00Z"), {
    date: "2026-08-18",
    organiserZone: "UTC",
    durationMinutes: 30,
    participants: team,
  });

  const ics = toIcs(slot, team, {
    title: "Weekly sync, all hands",
    organiserZone: "UTC",
    uid: "test-uid@meridian",
  });

  it("writes the instants as UTC", () => {
    expect(ics).toContain("DTSTART:20260818T130000Z");
    expect(ics).toContain("DTEND:20260818T133000Z");
  });

  it("escapes commas and folds the roster into the description", () => {
    expect(ics).toContain("SUMMARY:Weekly sync\\, all hands");
    expect(ics).toContain("Ana: 15:00 Europe/Madrid");
    expect(ics).toContain("Chen: 18:30 Asia/Kolkata");
  });

  it("uses CRLF line endings and closes the calendar", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
  });
});

describe("share state", () => {
  const state = {
    participants: team,
    date: "2026-08-18",
    organiserZone: "Europe/Madrid",
    durationMinutes: 45,
    stepMinutes: 30,
  };

  it("round-trips through a URL fragment", () => {
    expect(decodeState(`#${encodeState(state)}`)).toEqual(state);
  });

  it("rejects junk instead of half-applying it", () => {
    expect(decodeState("")).toBeNull();
    expect(decodeState("#not-base64!!")).toBeNull();
    expect(decodeState(`#${encodeState({ ...state, participants: [] })}`)).toBeNull();
  });
});

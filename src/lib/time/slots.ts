import {
  formatClock,
  instantFromWallClock,
  parseIsoDate,
  weekdayName,
  zonedParts,
} from "./zones";

export interface Participant {
  id: string;
  name: string;
  timeZone: string;
  /** Working window in the participant's own local time, in hours. */
  dayStart: number;
  dayEnd: number;
  /**
   * Days this person works, 0 = Sunday. Optional so rosters saved before this
   * existed still load; the weekend is not Saturday and Sunday everywhere, and
   * assuming so quietly excludes colleagues in much of the world.
   */
  workdays?: number[];
}

export type Quality = "core" | "fringe" | "outside";

export interface ParticipantSlot {
  participantId: string;
  hour: number;
  minute: number;
  /** -1, 0 or +1 relative to the organiser's date. */
  dayOffset: number;
  weekday: number;
  quality: Quality;
  label: string;
}

export interface Slot {
  startUtc: number;
  endUtc: number;
  entries: ParticipantSlot[];
  /** Mean quality across participants, 0-1. */
  score: number;
  /** Quality for the worst-served participant, 0-1. */
  fairness: number;
}

export interface SlotOptions {
  /** `YYYY-MM-DD`, read in the organiser's timezone. */
  date: string;
  organiserZone: string;
  durationMinutes: number;
  stepMinutes: number;
  participants: Participant[];
}

const QUALITY_WEIGHT: Record<Quality, number> = { core: 1, fringe: 0.45, outside: 0 };
/** How far outside the working window still counts as "askable". */
const FRINGE_HOURS = 1.5;

export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5];

export function workdaysOf(participant: Participant): number[] {
  return participant.workdays ?? DEFAULT_WORKDAYS;
}

function classify(participant: Participant, hours: number, weekday: number): Quality {
  if (!workdaysOf(participant).includes(weekday)) return "outside";
  const { dayStart, dayEnd } = participant;
  if (hours >= dayStart && hours <= dayEnd) return "core";
  if (hours >= dayStart - FRINGE_HOURS && hours <= dayEnd + FRINGE_HOURS) return "fringe";
  return "outside";
}

function worseOf(a: Quality, b: Quality): Quality {
  if (a === "outside" || b === "outside") return "outside";
  if (a === "fringe" || b === "fringe") return "fringe";
  return "core";
}

function dayDelta(base: { year: number; month: number; day: number }, other: { year: number; month: number; day: number }): number {
  const a = Date.UTC(base.year, base.month - 1, base.day);
  const b = Date.UTC(other.year, other.month - 1, other.day);
  return Math.round((b - a) / 86_400_000);
}

/** Evaluates one meeting start instant against every participant. */
export function evaluateSlot(
  startUtc: number,
  options: Pick<SlotOptions, "durationMinutes" | "participants" | "organiserZone" | "date">,
): Slot {
  const { durationMinutes, participants } = options;
  const start = new Date(startUtc);
  const end = new Date(startUtc + durationMinutes * 60_000);
  const organiserDate = parseIsoDate(options.date);

  const entries = participants.map<ParticipantSlot>((participant) => {
    const startParts = zonedParts(participant.timeZone, start);
    const endParts = zonedParts(participant.timeZone, end);

    const startHours = startParts.hour + startParts.minute / 60;
    const endHours = endParts.hour + endParts.minute / 60;

    const quality = worseOf(
      classify(participant, startHours, startParts.weekday),
      classify(participant, endHours, endParts.weekday),
    );

    return {
      participantId: participant.id,
      hour: startParts.hour,
      minute: startParts.minute,
      dayOffset: organiserDate ? dayDelta(organiserDate, startParts) : 0,
      weekday: startParts.weekday,
      quality,
      label: formatClock(startParts.hour, startParts.minute),
    };
  });

  const weights = entries.map((entry) => QUALITY_WEIGHT[entry.quality]);
  const score = weights.length === 0 ? 0 : weights.reduce((a, b) => a + b, 0) / weights.length;

  return {
    startUtc,
    endUtc: end.getTime(),
    entries,
    score,
    fairness: weights.length === 0 ? 0 : Math.min(...weights),
  };
}

/** Every candidate start across the organiser's chosen day. */
export function buildSlots(options: SlotOptions): Slot[] {
  const date = parseIsoDate(options.date);
  if (!date || options.participants.length === 0) return [];

  const dayStart = instantFromWallClock(options.organiserZone, {
    ...date,
    hour: 0,
    minute: 0,
  }).getTime();

  const step = Math.max(15, options.stepMinutes) * 60_000;
  const slots: Slot[] = [];

  for (let offset = 0; offset < 24 * 60 * 60_000; offset += step) {
    slots.push(evaluateSlot(dayStart + offset, options));
  }
  return slots;
}

/**
 * Best slots first. Fairness leads the ordering on purpose: a time that works
 * well for four people and not at all for the fifth is not a good meeting time.
 */
export function rankSlots(slots: Slot[], limit = 5): Slot[] {
  const ordered = [...slots].sort(
    (a, b) => b.fairness - a.fairness || b.score - a.score || a.startUtc - b.startUtc,
  );

  const picked: Slot[] = [];
  for (const slot of ordered) {
    if (slot.fairness === 0 && picked.length > 0) break;
    // Keep suggestions distinct rather than offering five variants of one hour.
    const tooClose = picked.some(
      (chosen) => Math.abs(chosen.startUtc - slot.startUtc) < 60 * 60_000,
    );
    if (tooClose) continue;
    picked.push(slot);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function describeSlot(slot: Slot, participants: Participant[], zone: string): string {
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  const start = new Date(slot.startUtc);
  const organiser = zonedParts(zone, start);
  const header = `${weekdayName(organiser.weekday)} ${organiser.day}/${organiser.month} — ${formatClock(
    organiser.hour,
    organiser.minute,
  )} ${zone}`;

  const lines = slot.entries.map((entry) => {
    const participant = byId.get(entry.participantId);
    const suffix = entry.dayOffset === 0 ? "" : entry.dayOffset > 0 ? " (next day)" : " (day before)";
    return `  ${participant?.name ?? "?"} — ${entry.label}${suffix}  ${participant?.timeZone ?? ""}`;
  });

  return [header, ...lines].join("\n");
}

/** `YYYY-MM-DD` shifted by whole days, without touching timezones. */
export function shiftDate(date: string, days: number): string {
  const parsed = parseIsoDate(date);
  if (!parsed) return date;
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Candidate slots across several consecutive days. Looking a week ahead is what
 * turns "there is no good time today" into "Thursday at 14:00 works for
 * everyone" — which is usually the answer people actually want.
 */
export function buildRangeSlots(options: SlotOptions, days: number): Slot[] {
  const slots: Slot[] = [];
  for (let offset = 0; offset < Math.max(1, days); offset += 1) {
    slots.push(...buildSlots({ ...options, date: shiftDate(options.date, offset) }));
  }
  return slots;
}

export interface DstShift {
  participantId: string;
  /** The first instant, in weeks from the slot, at which the local time moves. */
  weeksAhead: number;
  from: string;
  to: string;
}

/**
 * A recurring meeting is agreed once and then drifts: when a participant's zone
 * changes offset, the slot moves in their local clock even though the UTC
 * instant is unchanged. Worth knowing before the invitation goes out.
 */
export function detectDstShifts(
  slot: Slot,
  participants: Participant[],
  weeksAhead = 12,
): DstShift[] {
  const shifts: DstShift[] = [];

  for (const participant of participants) {
    const base = zonedParts(participant.timeZone, new Date(slot.startUtc));
    const baseLabel = formatClock(base.hour, base.minute);

    for (let week = 1; week <= weeksAhead; week += 1) {
      const later = zonedParts(
        participant.timeZone,
        new Date(slot.startUtc + week * 7 * 86_400_000),
      );
      const laterLabel = formatClock(later.hour, later.minute);

      if (laterLabel !== baseLabel) {
        shifts.push({
          participantId: participant.id,
          weeksAhead: week,
          from: baseLabel,
          to: laterLabel,
        });
        break;
      }
    }
  }

  return shifts;
}

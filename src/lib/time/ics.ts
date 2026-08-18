import { zonedParts } from "./zones";
import type { Participant, Slot } from "./slots";

/** RFC 5545 requires these characters to be escaped inside a text value. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function stampUtc(instant: Date): string {
  return `${instant.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

export interface IcsOptions {
  title: string;
  organiserZone: string;
  /** Stable identifier; callers pass one so the output is reproducible. */
  uid: string;
}

/**
 * A single-event calendar file. Times are written as UTC instants, which every
 * calendar client converts back to its own user's zone — the one case where
 * *not* carrying the timezone around is the correct choice.
 */
export function toIcs(
  slot: Slot,
  participants: Participant[],
  { title, organiserZone, uid }: IcsOptions,
): string {
  const byId = new Map(participants.map((participant) => [participant.id, participant]));
  const roster = slot.entries.map((entry) => {
    const participant = byId.get(entry.participantId);
    const suffix = entry.dayOffset === 0 ? "" : entry.dayOffset > 0 ? " (next day)" : " (day before)";
    return `${participant?.name ?? "?"}: ${entry.label}${suffix} ${participant?.timeZone ?? ""}`;
  });

  const organiser = zonedParts(organiserZone, new Date(slot.startUtc));

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//meridian//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stampUtc(new Date(slot.startUtc))}`,
    `DTSTART:${stampUtc(new Date(slot.startUtc))}`,
    `DTEND:${stampUtc(new Date(slot.endUtc))}`,
    `SUMMARY:${escapeText(title)}`,
    `DESCRIPTION:${escapeText(
      [`Local times (organiser: ${organiserZone}, ${String(organiser.hour).padStart(2, "0")}:${String(organiser.minute).padStart(2, "0")})`, ...roster].join("\n"),
    )}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // RFC 5545 mandates CRLF line endings.
  return `${lines.join("\r\n")}\r\n`;
}

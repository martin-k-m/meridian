"use client";

import { motion, useReducedMotion } from "motion/react";
import { entranceProps } from "@/components/ui/motion";
import { EmptyState } from "@/components/ui/controls";
import type { Participant, Rotation } from "@/lib/time/slots";
import { formatClock, weekdayName, zoneCity, zonedParts } from "@/lib/time/zones";

interface RotationViewProps {
  rotation: Rotation;
  participants: Participant[];
  organiserZone: string;
  onCopy: (text: string) => void;
  copied: boolean;
}

export function RotationView({
  rotation,
  participants,
  organiserZone,
  onCopy,
  copied,
}: RotationViewProps) {
  const reduce = useReducedMotion();

  if (rotation.entries.length === 0) {
    return <EmptyState title="Nothing to rotate" hint="Add participants to plan a recurring slot." />;
  }

  const summary = rotation.entries
    .map((entry, index) => {
      const organiser = zonedParts(organiserZone, new Date(entry.slot.startUtc));
      const names = entry.stretchedBy
        .map((id) => participants.find((p) => p.id === id)?.name ?? "?")
        .join(", ");
      return `${index + 1}. ${weekdayName(organiser.weekday)} ${formatClock(organiser.hour, organiser.minute)} ${zoneCity(organiserZone)}${
        names ? ` — stretches: ${names}` : " — suits everyone"
      }`;
    })
    .join("\n");

  return (
    <div className="flex h-full flex-col">
      <p className="shrink-0 border-b border-line px-4 py-2 text-xs text-muted">
        {rotation.needed
          ? "No single time suits everyone, so the awkward slot moves around instead of always landing on the same person."
          : "One time suits everyone, so every occurrence can use it."}
      </p>

      <ol className="min-h-0 flex-1 overflow-auto p-2">
        {rotation.entries.map((entry, index) => {
          const organiser = zonedParts(organiserZone, new Date(entry.slot.startUtc));

          return (
            <motion.li
              key={`${entry.slot.startUtc}-${index}`}
              {...entranceProps(reduce, { index, duration: 0.24, step: 0.04 })}
              className="mb-1.5 rounded-lg border border-line p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular text-sm font-medium text-fg">
                  <span className="mr-1.5 text-[11px] text-subtle">#{index + 1}</span>
                  {weekdayName(organiser.weekday)} {formatClock(organiser.hour, organiser.minute)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-subtle">
                  {zoneCity(organiserZone)}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap gap-1">
                {entry.slot.entries.map((slotEntry) => {
                  const participant = participants.find((p) => p.id === slotEntry.participantId);
                  const stretched = entry.stretchedBy.includes(slotEntry.participantId);
                  return (
                    <span
                      key={slotEntry.participantId}
                      className={`tabular rounded px-1.5 py-0.5 text-[11px] ${
                        stretched ? "bg-warn/15 text-warn" : "bg-raised text-muted"
                      }`}
                    >
                      {participant?.name} {slotEntry.label}
                    </span>
                  );
                })}
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="shrink-0 border-t border-line p-2">
        <div className="mb-2 flex flex-wrap gap-1.5 px-1">
          {participants.map((participant) => (
            <span key={participant.id} className="text-[11px] text-subtle">
              {participant.name} stretches{" "}
              <span className="tabular text-muted">{rotation.burden[participant.id] ?? 0}×</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onCopy(summary)}
          className="w-full rounded border border-line py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          {copied ? "Copied" : "Copy the rotation"}
        </button>
      </div>
    </div>
  );
}

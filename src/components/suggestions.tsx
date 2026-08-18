"use client";

import { motion } from "motion/react";
import type { DstShift, Participant, Slot } from "@/lib/time/slots";
import { EmptyState } from "@/components/ui/controls";
import { formatClock, weekdayName, zoneCity, zonedParts } from "@/lib/time/zones";

interface SuggestionsProps {
  slots: Slot[];
  participants: Participant[];
  organiserZone: string;
  selectedStart: number | null;
  onSelect: (slot: Slot) => void;
  onCopy: (slot: Slot) => void;
  onDownload: (slot: Slot) => void;
  copiedStart: number | null;
  /** Week-long searches need the day spelled out, not just the time. */
  showDate: boolean;
  /** Clock changes that would move this slot for someone, keyed by slot start. */
  shifts: Map<number, DstShift[]>;
}

export function Suggestions({
  slots,
  participants,
  organiserZone,
  selectedStart,
  onSelect,
  onCopy,
  onDownload,
  copiedStart,
  showDate,
  shifts,
}: SuggestionsProps) {
  if (slots.length === 0) {
    return (
      <EmptyState
        title="No workable time on this day"
        hint="Try the next day, shorten the meeting, or widen someone's working hours."
      />
    );
  }

  return (
    <ul className="h-full overflow-auto p-2">
      {slots.map((slot, index) => {
        const organiser = zonedParts(organiserZone, new Date(slot.startUtc));
        const selected = slot.startUtc === selectedStart;

        return (
          <motion.li
            key={slot.startUtc}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.05 }}
            className={`mb-1.5 rounded-lg border p-3 transition-colors ${
              selected ? "border-accent bg-raised" : "border-line hover:border-line-strong"
            }`}
          >
            <button type="button" onClick={() => onSelect(slot)} className="w-full text-left">
              <div className="flex items-baseline justify-between gap-3">
                <span className="tabular text-sm font-medium text-fg">
                  {weekdayName(organiser.weekday)}
                  {showDate ? ` ${organiser.day}/${organiser.month}` : ""}{" "}
                  {formatClock(organiser.hour, organiser.minute)}
                  <span className="ml-1.5 text-[11px] font-normal text-subtle">
                    {zoneCity(organiserZone)}
                  </span>
                </span>
                <QualityMeter value={slot.fairness} />
              </div>

              <dl className="mt-2 space-y-1">
                {slot.entries.map((entry) => {
                  const participant = participants.find((p) => p.id === entry.participantId);
                  return (
                    <div key={entry.participantId} className="flex items-baseline justify-between gap-3">
                      <dt className="truncate text-xs text-muted">{participant?.name}</dt>
                      <dd
                        className={`tabular shrink-0 text-xs ${
                          entry.quality === "outside"
                            ? "text-err"
                            : entry.quality === "fringe"
                              ? "text-warn"
                              : "text-fg"
                        }`}
                      >
                        {entry.label}
                        {entry.dayOffset !== 0 && (
                          <span className="ml-1 text-[10px] text-subtle">
                            {entry.dayOffset > 0 ? "+1d" : "−1d"}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </button>

            <DstNotice shifts={shifts.get(slot.startUtc) ?? []} participants={participants} />

            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => onCopy(slot)}
                className="flex-1 rounded border border-line py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                {copiedStart === slot.startUtc ? "Copied" : "Copy summary"}
              </button>
              <button
                type="button"
                onClick={() => onDownload(slot)}
                className="rounded border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
                title="Download a calendar invitation"
              >
                .ics
              </button>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

function DstNotice({
  shifts,
  participants,
}: {
  shifts: DstShift[];
  participants: Participant[];
}) {
  if (shifts.length === 0) return null;
  const soonest = [...shifts].sort((a, b) => a.weeksAhead - b.weeksAhead);

  return (
    <p className="mt-2 rounded border border-warn/40 bg-warn/[0.07] px-2 py-1.5 text-[11px] text-muted">
      {soonest.map((shift) => {
        const who = participants.find((participant) => participant.id === shift.participantId);
        return (
          <span key={shift.participantId} className="block">
            In {shift.weeksAhead} {shift.weeksAhead === 1 ? "week" : "weeks"} this becomes{" "}
            {shift.to} for {who?.name ?? "someone"} (from {shift.from}) — their clocks change.
          </span>
        );
      })}
    </p>
  );
}

function QualityMeter({ value }: { value: number }) {
  const label = value === 1 ? "works for everyone" : value > 0 ? "someone stretches" : "someone loses out";
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-subtle">{label}</span>
      <span className="flex gap-0.5" aria-hidden>
        {[0.34, 0.67, 1].map((threshold) => (
          <span
            key={threshold}
            className={`h-3 w-1 rounded-full ${
              value >= threshold ? "bg-accent" : "bg-line"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

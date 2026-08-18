"use client";

import { motion, useReducedMotion } from "motion/react";
import { entranceProps } from "@/components/ui/motion";
import type { Participant, Quality, Slot } from "@/lib/time/slots";
import { formatClock, zoneCity } from "@/lib/time/zones";

interface HeatGridProps {
  slots: Slot[];
  participants: Participant[];
  organiserZone: string;
  selectedStart: number | null;
  onSelect: (slot: Slot) => void;
}

const QUALITY_CLASS: Record<Quality, string> = {
  core: "bg-accent/85 text-accent-fg",
  fringe: "bg-accent/25 text-fg",
  outside: "bg-raised text-subtle",
};

/**
 * One column per candidate start time, one row per person, each cell showing
 * that person's own local clock. Reading down a column answers "what time is
 * this for everyone?" without any mental arithmetic.
 */
export function HeatGrid({
  slots,
  participants,
  organiserZone,
  selectedStart,
  onSelect,
}: HeatGridProps) {
  if (slots.length === 0 || participants.length === 0) {
    return (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-subtle">
        Add someone to see the day laid out.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="min-w-[820px] p-3">
        <div
          className="grid gap-px"
          style={{ gridTemplateColumns: `120px repeat(${slots.length}, minmax(0, 1fr))` }}
        >
          <div className="sticky left-0 z-10 bg-surface pb-1 text-[10px] uppercase tracking-wider text-subtle">
            {zoneCity(organiserZone)}
          </div>
          {slots.map((slot) => {
            const hour = new Date(slot.startUtc);
            return (
              <button
                key={slot.startUtc}
                type="button"
                onClick={() => onSelect(slot)}
                className="relative pb-1 text-center text-[10px] text-subtle transition-colors hover:text-fg"
              >
                {hour.getUTCMinutes() === 0 || slots.length <= 24 ? (
                  <OrganiserLabel slot={slot} organiserZone={organiserZone} />
                ) : null}
              </button>
            );
          })}

          {participants.map((participant) => (
            <PersonRow
              key={participant.id}
              participant={participant}
              slots={slots}
              selectedStart={selectedStart}
              onSelect={onSelect}
            />
          ))}
        </div>

        <Legend />
      </div>
    </div>
  );
}

function OrganiserLabel({ slot, organiserZone }: { slot: Slot; organiserZone: string }) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: organiserZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return <span className="tabular">{formatter.format(new Date(slot.startUtc))}</span>;
}

function PersonRow({
  participant,
  slots,
  selectedStart,
  onSelect,
}: {
  participant: Participant;
  slots: Slot[];
  selectedStart: number | null;
  onSelect: (slot: Slot) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <>
      <div className="sticky left-0 z-10 flex items-center gap-1.5 bg-surface pr-2 text-[12px]">
        <span className="truncate font-medium text-fg">{participant.name}</span>
        <span className="truncate text-[11px] text-subtle">{zoneCity(participant.timeZone)}</span>
      </div>

      {slots.map((slot, index) => {
        const entry = slot.entries.find((item) => item.participantId === participant.id);
        if (!entry) return <div key={slot.startUtc} />;
        const selected = slot.startUtc === selectedStart;

        return (
          <motion.button
            key={slot.startUtc}
            type="button"
            onClick={() => onSelect(slot)}
            {...entranceProps(reduce, { index, distance: 0, duration: 0.25, step: 0.008 })}
            title={`${participant.name}: ${formatClock(entry.hour, entry.minute)}${
              entry.dayOffset === 0 ? "" : entry.dayOffset > 0 ? " next day" : " previous day"
            }`}
            className={`relative h-7 text-[10px] leading-7 transition-colors first:rounded-l last:rounded-r ${QUALITY_CLASS[entry.quality]} ${
              selected ? "z-10" : ""
            }`}
          >
            <span className="tabular">{String(entry.hour).padStart(2, "0")}</span>
            {selected && (
              <motion.span
                layoutId="selected-column"
                transition={{ type: "spring", stiffness: 480, damping: 36 }}
                className="pointer-events-none absolute inset-0 rounded ring-2 ring-fg"
              />
            )}
          </motion.button>
        );
      })}
    </>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex items-center gap-4 text-[11px] text-subtle">
      {(
        [
          ["core", "inside working hours"],
          ["fringe", "just outside"],
          ["outside", "night, or the weekend"],
        ] as const
      ).map(([quality, label]) => (
        <span key={quality} className="flex items-center gap-1.5">
          <span className={`h-3 w-5 rounded-sm ${QUALITY_CLASS[quality]}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

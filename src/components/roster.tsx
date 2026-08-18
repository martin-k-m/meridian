"use client";

import { AnimatePresence, motion } from "motion/react";
import { ZonePicker } from "@/components/zone-picker";
import { Button } from "@/components/ui/controls";
import type { Participant } from "@/lib/time/slots";

interface RosterProps {
  participants: Participant[];
  onChange: (id: string, patch: Partial<Participant>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export function Roster({ participants, onChange, onRemove, onAdd }: RosterProps) {
  return (
    <div className="flex h-full flex-col">
      <ul className="min-h-0 flex-1 overflow-auto">
        <AnimatePresence initial={false}>
          {participants.map((participant) => (
            <motion.li
              key={participant.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="group border-b border-line"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  value={participant.name}
                  onChange={(event) => onChange(participant.id, { name: event.target.value })}
                  aria-label="Name"
                  placeholder="Name"
                  className="w-24 shrink-0 rounded px-1 py-1 text-[13px] font-medium outline-none placeholder:text-subtle focus:bg-raised"
                />

                <div className="min-w-0 flex-1">
                  <ZonePicker
                    value={participant.timeZone}
                    onChange={(timeZone) => onChange(participant.id, { timeZone })}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1 text-[11px] text-subtle">
                  <HourInput
                    value={participant.dayStart}
                    onChange={(dayStart) => onChange(participant.id, { dayStart })}
                    label={`${participant.name} day starts`}
                  />
                  <span>–</span>
                  <HourInput
                    value={participant.dayEnd}
                    onChange={(dayEnd) => onChange(participant.id, { dayEnd })}
                    label={`${participant.name} day ends`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(participant.id)}
                  aria-label={`Remove ${participant.name}`}
                  className="shrink-0 rounded p-1 text-subtle opacity-0 transition-opacity hover:text-err focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="shrink-0 border-t border-line p-2">
        <Button variant="outline" onClick={onAdd} className="w-full justify-center">
          Add person
        </Button>
      </div>
    </div>
  );
}

function HourInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <input
      type="number"
      min={0}
      max={23}
      value={value}
      aria-label={label}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(Math.min(23, Math.max(0, next)));
      }}
      className="tabular w-9 rounded px-1 py-1 text-center outline-none focus:bg-raised"
    />
  );
}

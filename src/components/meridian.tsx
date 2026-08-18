"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Roster } from "@/components/roster";
import { HeatGrid } from "@/components/heat-grid";
import { Suggestions } from "@/components/suggestions";
import { ZonePicker } from "@/components/zone-picker";
import { Panel } from "@/components/ui/panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/controls";
import {
  buildRangeSlots,
  buildSlots,
  detectDstShifts,
  describeSlot,
  rankSlots,
  type Participant,
  type Slot,
} from "@/lib/time/slots";
import { toIcs } from "@/lib/time/ics";
import { decodeState, encodeState } from "@/lib/share";
import { isoDate, localZone, zonedParts } from "@/lib/time/zones";

const STORAGE_KEY = "meridian.roster.v1";
const DURATIONS = [30, 45, 60, 90] as const;
const STEPS = [30, 60] as const;

function seedRoster(home: string): Participant[] {
  const others = ["America/New_York", "Asia/Kolkata"].filter((zone) => zone !== home);
  return [
    { id: "you", name: "You", timeZone: home, dayStart: 9, dayEnd: 17 },
    { id: "p2", name: "Ben", timeZone: others[0] ?? "Europe/London", dayStart: 9, dayEnd: 17 },
    { id: "p3", name: "Chen", timeZone: others[1] ?? "Asia/Tokyo", dayStart: 10, dayEnd: 19 },
  ];
}

export function Meridian() {
  // Everything below depends on the viewer's own clock and timezone, so it is
  // resolved after mount rather than guessed on the server.
  const [ready, setReady] = useState(false);
  const [organiserZone, setOrganiserZone] = useState("UTC");
  const [date, setDate] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [stepMinutes, setStepMinutes] = useState<number>(60);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [copiedStart, setCopiedStart] = useState<number | null>(null);
  const [scope, setScope] = useState<"day" | "week">("day");
  const [sharedLink, setSharedLink] = useState(false);

  useEffect(() => {
    const home = localZone();
    setOrganiserZone(home);
    setDate(isoDate(home, new Date()));

    const shared = decodeState(window.location.hash);
    if (shared) {
      setOrganiserZone(shared.organiserZone);
      setDate(shared.date || isoDate(shared.organiserZone, new Date()));
      setParticipants(shared.participants);
      setDurationMinutes(shared.durationMinutes);
      setStepMinutes(shared.stepMinutes);
      setReady(true);
      return;
    }

    let restored: Participant[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) restored = parsed as Participant[];
      }
    } catch {
      restored = null;
    }

    setParticipants(restored ?? seedRoster(home));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
    } catch {
      // Storage is a convenience here, not a requirement.
    }
  }, [participants, ready]);

  const slots = useMemo(
    () =>
      ready
        ? buildSlots({ date, organiserZone, durationMinutes, stepMinutes, participants })
        : [],
    [ready, date, organiserZone, durationMinutes, stepMinutes, participants],
  );

  const searchSpace = useMemo(
    () =>
      ready && scope === "week"
        ? buildRangeSlots({ date, organiserZone, durationMinutes, stepMinutes, participants }, 7)
        : slots,
    [ready, scope, date, organiserZone, durationMinutes, stepMinutes, participants, slots],
  );

  const ranked = useMemo(() => rankSlots(searchSpace, 4), [searchSpace]);

  // Only the shortlist is checked: scanning every candidate for clock changes
  // would be a lot of formatting for slots nobody is going to pick.
  const shifts = useMemo(
    () =>
      new Map(ranked.map((slot) => [slot.startUtc, detectDstShifts(slot, participants, 12)])),
    [ranked, participants],
  );

  const updateParticipant = useCallback((id: string, patch: Partial<Participant>) => {
    setParticipants((current) =>
      current.map((participant) =>
        participant.id === id ? { ...participant, ...patch } : participant,
      ),
    );
  }, []);

  const addParticipant = useCallback(() => {
    setParticipants((current) => [
      ...current,
      {
        id: `p${Date.now().toString(36)}`,
        name: `Person ${current.length + 1}`,
        timeZone: "Europe/London",
        dayStart: 9,
        dayEnd: 17,
      },
    ]);
  }, []);

  const removeParticipant = useCallback((id: string) => {
    setParticipants((current) => current.filter((participant) => participant.id !== id));
  }, []);

  const copySummary = useCallback(
    async (slot: Slot) => {
      try {
        await navigator.clipboard.writeText(describeSlot(slot, participants, organiserZone));
        setCopiedStart(slot.startUtc);
        setTimeout(() => setCopiedStart(null), 1600);
      } catch {
        setCopiedStart(null);
      }
    },
    [participants, organiserZone],
  );

  const shareLink = useCallback(async () => {
    const hash = encodeState({ participants, date, organiserZone, durationMinutes, stepMinutes });
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    window.history.replaceState(null, "", `#${hash}`);
    try {
      await navigator.clipboard.writeText(url);
      setSharedLink(true);
      setTimeout(() => setSharedLink(false), 1600);
    } catch {
      setSharedLink(false);
    }
  }, [participants, date, organiserZone, durationMinutes, stepMinutes]);

  const downloadIcs = useCallback(
    (slot: Slot) => {
      const parts = zonedParts(organiserZone, new Date(slot.startUtc));
      const ics = toIcs(slot, participants, {
        title: "Meeting",
        organiserZone,
        uid: `${slot.startUtc}@meridian`,
      });
      const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `meeting-${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}.ics`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [participants, organiserZone],
  );

  const shiftDay = useCallback(
    (days: number) => {
      setDate((current) => {
        const [year, month, day] = current.split("-").map(Number);
        if (!year || !month || !day) return current;
        const next = new Date(Date.UTC(year, month - 1, day + days));
        return next.toISOString().slice(0, 10);
      });
      setSelectedStart(null);
    },
    [],
  );

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[1500px] flex-col gap-3 p-3 lg:h-[100dvh] lg:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-medium tracking-tight text-fg">
            meridian<span className="text-accent">.</span>
          </h1>
          <p className="hidden text-xs text-subtle sm:block">
            Meeting times across timezones, in everyone&rsquo;s own clock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-line px-1">
            <StepButton onClick={() => shiftDay(-1)} label="Previous day" direction="left" />
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedStart(null);
              }}
              aria-label="Meeting date"
              className="tabular bg-transparent px-1 py-1 text-[13px] outline-none"
            />
            <StepButton onClick={() => shiftDay(1)} label="Next day" direction="right" />
          </div>

          <Choice
            label="Duration"
            value={durationMinutes}
            options={DURATIONS}
            onChange={setDurationMinutes}
            format={(value) => (value >= 60 ? `${value / 60}h` : `${value}m`)}
          />
          <Choice
            label="Step"
            value={stepMinutes}
            options={STEPS}
            onChange={(value) => {
              setStepMinutes(value);
              setSelectedStart(null);
            }}
            format={(value) => `${value}m`}
          />
          <Button variant="outline" onClick={shareLink}>
            {sharedLink ? "Link copied" : "Share"}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col gap-3">
          <Panel
            order={0}
            title="Who is meeting"
            hint={`${participants.length} ${participants.length === 1 ? "person" : "people"}`}
            actions={
              <div className="flex items-center gap-1.5 text-[11px] text-subtle">
                <span>your zone</span>
                <div className="w-36">
                  <ZonePicker
                    value={organiserZone}
                    onChange={setOrganiserZone}
                    label="Your timezone"
                  />
                </div>
              </div>
            }
            className="h-[248px] shrink-0"
          >
            <Roster
              participants={participants}
              onChange={updateParticipant}
              onRemove={removeParticipant}
              onAdd={addParticipant}
            />
          </Panel>

          <Panel order={1} title="The day, everywhere" className="min-h-0 flex-1">
            <HeatGrid
              slots={slots}
              participants={participants}
              organiserZone={organiserZone}
              selectedStart={selectedStart}
              onSelect={(slot) => setSelectedStart(slot.startUtc)}
            />
          </Panel>
        </div>

        <Panel
          order={2}
          title="Best times"
          actions={
            <Choice
              label="Search range"
              value={scope}
              options={["day", "week"] as const}
              onChange={setScope}
              format={(value) => (value === "day" ? "this day" : "next 7 days")}
            />
          }
          className="min-h-0"
        >
          <Suggestions
            slots={ranked}
            participants={participants}
            organiserZone={organiserZone}
            selectedStart={selectedStart}
            onSelect={(slot) => setSelectedStart(slot.startUtc)}
            onCopy={copySummary}
            onDownload={downloadIcs}
            copiedStart={copiedStart}
            showDate={scope === "week"}
            shifts={shifts}
          />
        </Panel>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  label,
  direction,
}: {
  onClick: () => void;
  label: string;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded p-1 text-subtle transition-colors hover:bg-raised hover:text-fg"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </svg>
    </button>
  );
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  format,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-raised p-0.5" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={option === value}
          className={`rounded px-2 py-1 text-[11px] transition-colors ${
            option === value ? "bg-surface text-fg" : "text-subtle hover:text-muted"
          }`}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

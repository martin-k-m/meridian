# meridian

*The lines of longitude that are, in the end, what timezones are.*

Find a meeting time that is civil for everybody, shown in each person's own
local clock, with daylight saving handled by the timezone database rather than
by arithmetic in your head.

Runs entirely in the browser. The roster is kept in local storage and never
leaves the machine.

## What it does

- **The whole day at a glance.** One column per candidate start time, one row per
  person, each cell showing that person's own local clock and shaded by whether
  it falls inside their working hours, just outside, or in the middle of their
  night.
- **Ranked suggestions**, ordered by *fairness* before average quality: a slot
  that suits four people and ruins the fifth is not a good meeting time, and the
  ranking says so.
- **Per-person working hours**, because 09:00–17:00 is not universal.
- **Day rollover made visible** — a slot that lands at 01:30 tomorrow for a
  colleague in Asia is labelled `+1d` rather than quietly shown as 01:30.
- **Search the whole week.** When today has nothing workable — a Saturday, or a
  spread of timezones that simply do not overlap — switching the search to the
  next seven days finds the first day that does.
- **Share the roster as a link.** The participants, date and settings live in
  the URL fragment, so a colleague opens exactly what you were looking at.
- **Download the invitation** as an `.ics` file, with everyone's local time in
  the description. Times are written as UTC instants, which every calendar
  client converts back for its own user.
- **Copy summary** produces the paste-ready block you actually send:

  ```
  Tue 18/8 — 13:00 Europe/Madrid
    Ana — 15:00  Europe/Madrid
    Ben — 09:00  America/New_York
    Chen — 18:30  Asia/Kolkata
  ```

## How the time handling works

Every conversion goes through a real instant rather than offset arithmetic:

- `zonedParts(zone, instant)` asks `Intl` what the wall clock reads there.
- `offsetMinutes(zone, instant)` derives the offset from that answer, truncating
  the instant to minute resolution first — skipping that step is what produces
  the classic `UTC+2:59` bug.
- `instantFromWallClock(zone, wall)` resolves in two passes, because the offset
  that applies depends on the instant you are trying to find. The second pass is
  what makes times near a DST boundary land on the right side of it.

Slots are judged on both their **start and end**, so a three-hour meeting that
begins inside someone's day but finishes at 22:00 for them is scored on the
22:00. Weekends count as outside working hours in the participant's own zone,
which is not always the same day as yours.

The tests in [`time.test.ts`](src/lib/time/time.test.ts) cover both DST
transitions in both hemispheres, half-hour zones, seconds on the instant, and
the date rolling over.

## Layout

```
src/
  lib/time/
    zones.ts    Intl-based conversions, offsets, zone metadata
    slots.ts    participants, slot scoring, ranking, summary text
  components/   roster, heat grid, suggestions, zone picker
  app/          route, metadata, theme tokens
```

`lib/` is pure and DOM-free; the components only present what it computes.

## Development

```bash
npm install
npm run dev
```

```bash
npm test
npm run typecheck
npm run build
```

## Known limits

- The day grid covers a single day at a time, in the organiser's zone.
- Working hours are a simple daily window — no lunch breaks, no per-weekday
  variation, no holiday calendars.
- Availability is modelled from working hours only. It does not read anyone's
  calendar, which is also why it needs no accounts and no permissions.

## Licence

MIT.

import type { Participant } from "./time/slots";

export interface ShareState {
  participants: Participant[];
  date: string;
  organiserZone: string;
  durationMinutes: number;
  stepMinutes: number;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeState(state: ShareState): string {
  return toBase64Url(JSON.stringify(state));
}

/** Anything malformed is discarded rather than half-applied. */
export function decodeState(fragment: string): ShareState | null {
  const raw = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(fromBase64Url(raw));
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Partial<ShareState>;

    if (!Array.isArray(value.participants) || value.participants.length === 0) return null;
    const participants = value.participants.filter(
      (participant): participant is Participant =>
        typeof participant?.id === "string" &&
        typeof participant?.name === "string" &&
        typeof participant?.timeZone === "string" &&
        typeof participant?.dayStart === "number" &&
        typeof participant?.dayEnd === "number",
    );
    if (participants.length === 0) return null;

    return {
      participants,
      date: typeof value.date === "string" ? value.date : "",
      organiserZone: typeof value.organiserZone === "string" ? value.organiserZone : "UTC",
      durationMinutes: typeof value.durationMinutes === "number" ? value.durationMinutes : 30,
      stepMinutes: typeof value.stepMinutes === "number" ? value.stepMinutes : 60,
    };
  } catch {
    return null;
  }
}

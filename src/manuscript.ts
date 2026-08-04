/**
 * The parts of a manuscript that hold true whatever it's rendered into.
 *
 * Kept apart from `docx.ts` so the RTF emitter can use them without pulling the
 * `docx` library — and its zip machinery — into a code path that only ever
 * writes text.
 */
import type { SmfSettings } from "./settings";

export function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "AUTHOR";
}

/**
 * "about" appears only when the number shown isn't the true count. Printing it
 * over an exact figure claims an approximation that isn't there, and dropping
 * it from a rounded one claims a precision that isn't there either.
 *
 * That also covers rounding landing exactly on the count: 3,400 words rounds to
 * 3,400, and there is nothing approximate about it.
 */
export function formatWordCount(count: number, round: boolean): string {
  const shown = round && count >= 100 ? Math.round(count / 100) * 100 : count;
  const prefix = shown === count ? "" : "about ";
  return `${prefix}${shown.toLocaleString("en-US")} words`;
}

/** The contact block, upper left on the title page, in Shunn's order. */
export function contactLines(settings: SmfSettings): string[] {
  const lines: string[] = [];
  if (settings.legalName) lines.push(settings.legalName);
  if (settings.includeAddress && settings.address.trim()) {
    lines.push(...settings.address.split(/\r?\n/).filter((l) => l.trim()));
  }
  if (settings.includePhone && settings.phone) lines.push(settings.phone);
  if (settings.includeEmail && settings.email) lines.push(settings.email);
  if (settings.membership) lines.push(settings.membership);
  return lines;
}

/** `Surname / KEYWORD / ` — the page number is appended by each emitter. */
export function runningHeadPrefix(
  shortTitle: string | null,
  settings: SmfSettings
): string {
  const surname = surnameOf(settings.penName || settings.legalName || "");
  return `${surname} / ${shortTitle ?? "UNTITLED"} / `;
}

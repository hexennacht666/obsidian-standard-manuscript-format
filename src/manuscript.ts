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
 * The running head's name: what the writer stated, or the last word of the name
 * they're submitting under.
 *
 * Deriving is a guess, and it is wrong for particles ("Le Guin" heads as
 * "Guin"), for double surnames, and for suffixes. It stays as the default
 * because it's right for most names and costs nothing when it is — but the
 * stated value always wins, and the settings page shows the derived one so a
 * bad guess is visible while the writer is right there.
 */
export function runningHeadName(settings: SmfSettings): string {
  return (
    settings.surname.trim() ||
    surnameOf(settings.penName || settings.legalName || "")
  );
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

/**
 * The contact-block name, carrying pronouns in parentheses after it.
 *
 * The markets that want pronouns (Strange Horizons, Uncanny) want them beside
 * the name in the contact block and state no form for them. Contact block only:
 * the byline is a different line with a different job, and the running head is a
 * surname and a keyword.
 */
export function nameWithPronouns(name: string, pronouns: string): string {
  const stated = pronouns.trim();
  return stated ? `${name} (${stated})` : name;
}

/** The contact block, upper left on the title page, in Shunn's order. */
export function contactLines(settings: SmfSettings): string[] {
  // "Anonymous" means nothing identifying anywhere, and this block is nothing
  // but identifying. "Identified cover page" deliberately keeps it: that
  // arrangement wants the name here and on no page after it.
  if (settings.blindSubmission === "anonymous") return [];

  const lines: string[] = [];
  if (settings.legalName) {
    lines.push(nameWithPronouns(settings.legalName, settings.pronouns));
  }
  if (settings.includeAddress && settings.address.trim()) {
    lines.push(...settings.address.split(/\r?\n/).filter((l) => l.trim()));
  }
  if (settings.includePhone && settings.phone) lines.push(settings.phone);
  if (settings.includeEmail && settings.email) lines.push(settings.email);
  if (settings.membership) lines.push(settings.membership);
  return lines;
}

/**
 * The byline, or nothing when the manuscript must not carry a name. Shared so
 * the two emitters can't answer the question differently.
 */
export function bylineOf(settings: SmfSettings): string {
  if (settings.blindSubmission === "anonymous") return "";
  return settings.penName || settings.legalName;
}

/** `Surname / KEYWORD / ` — the page number is appended by each emitter. */
export function runningHeadPrefix(
  shortTitle: string | null,
  settings: SmfSettings
): string {
  const title = shortTitle ?? "UNTITLED";
  // The one place both blind arrangements agree: every page after the first
  // carries the title and a page number and no name at all. It's also the
  // easiest place to leave a name by accident, being set once and never read.
  if (settings.blindSubmission !== "off") return `${title} / `;

  return `${runningHeadName(settings)} / ${title} / `;
}

/**
 * The one line both emitters print, wherever it's printed. Shared so the title
 * page and the manuscript can't word it differently.
 */
export function contentWarningLine(
  warnings: string[],
  settings: SmfSettings
): string {
  return `${settings.contentWarningLabel.trim()}: ${warnings.join(", ")}`;
}

/** Whether warnings are printed in a given place, given the story has any. */
export function showsContentWarnings(
  where: "titlePage" | "story",
  warnings: string[],
  settings: SmfSettings
): boolean {
  if (!settings.includeContentWarnings || !warnings.length) return false;
  return (
    settings.contentWarningPlacement === "both" ||
    settings.contentWarningPlacement === where
  );
}

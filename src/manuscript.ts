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
 * Word's single line spacing for a font size, in points. The true figure comes
 * from each font's own metrics; 1.15 times the size is Times New Roman's, and
 * near enough for the other faces a manuscript uses that the title still lands
 * within a line of where it should.
 */
export function singleLinePoints(fontSize: number): number {
  return fontSize * 1.15;
}

/** Shunn's title line starts four inches below the top margin: the page's middle. */
const TITLE_DROP_POINTS = 288;

/** So a very tall contact block still leaves the title some air. */
const MIN_TITLE_GAP_LINES = 2;

/**
 * How many empty single-spaced lines go between the contact band and the
 * title, given how many lines the band takes up.
 */
export function titleGapLines(bandLines: number, fontSize: number): number {
  const total = Math.round(TITLE_DROP_POINTS / singleLinePoints(fontSize));
  return Math.max(MIN_TITLE_GAP_LINES, total - bandLines);
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
export function runningHeadPrefix(shortTitle: string, settings: SmfSettings): string {
  // The one place both blind arrangements agree: every page after the first
  // carries the title and a page number and no name at all. It's also the
  // easiest place to leave a name by accident, being set once and never read.
  if (settings.blindSubmission !== "off") return `${shortTitle} / `;

  return `${runningHeadName(settings)} / ${shortTitle} / `;
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

/**
 * Whether the title page is a page of its own. Shunn's modern format starts the
 * story on page 1 under the byline; only an identified cover page keeps the
 * writer's details on a separate page, because that is what it is for.
 */
export function hasCoverPage(settings: SmfSettings): boolean {
  return settings.blindSubmission === "coverPage";
}

/**
 * Whether warnings are printed in a given place, given the story has any.
 *
 * When the story starts under the byline, the title page and the story's
 * opening are the same spot, so every placement prints them once, under the
 * byline.
 */
export function showsContentWarnings(
  where: "titlePage" | "story",
  warnings: string[],
  settings: SmfSettings
): boolean {
  if (!settings.includeContentWarnings || !warnings.length) return false;
  if (!hasCoverPage(settings)) return where === "titlePage";
  return (
    settings.contentWarningPlacement === "both" ||
    settings.contentWarningPlacement === where
  );
}

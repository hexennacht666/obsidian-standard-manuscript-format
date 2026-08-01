/**
 * Straight-to-typographic conversion for manuscript text.
 *
 * Runs on the whole paragraph before inline emphasis is parsed, which is safe
 * because every substitution here is character-for-character and none of them
 * touch the `*` / `_` emphasis markers.
 */

// Characters that mean a following double/single quote is an OPENING quote.
const OPENERS = new Set(["(", "[", "{", "‘", "“", "*", "_", "/", "—", "–"]);

function isOpeningContext(prev: string | undefined): boolean {
  if (prev === undefined) return true;
  if (/\s/.test(prev)) return true;
  return OPENERS.has(prev);
}

// A quote is only *confidently* opening or closing when both the character
// before and the character after agree. When they don't, the quote is genuinely
// ambiguous (`—"` sits before interrupted dialogue AND before speech starting
// mid-sentence) and running state decides instead.
const looksOpening = (prev: string | undefined, next: string | undefined) =>
  isOpeningContext(prev) && next !== undefined && /[A-Za-z0-9'’‘]/.test(next);

const looksClosing = (prev: string | undefined, next: string | undefined) =>
  prev !== undefined &&
  /[A-Za-z0-9,.!?;:…’)]/.test(prev) &&
  (next === undefined || /[\s)\]}.,;:!?—–]/.test(next));

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9]/.test(c);
}

// Elisions that open with an apostrophe rather than a single quote. Without
// this list the re-curl pass turns ’em into ‘em, which looks like a stray quote.
const LEADING_ELISIONS =
  /^(?:em|tis|twas|round|cause|bout|til|till|neath|nother|way)\b/i;

export interface TypographyResult {
  text: string;
  /**
   * True when the paragraph ends with a double quote still open. On its own
   * this means nothing — speech running over several paragraphs opens each one
   * and closes only at the end. Only the caller, which can see whether the next
   * paragraph continues the speech, can tell that apart from a missing quote.
   */
  endsOpen: boolean;
}

export function smartTypography(input: string): string {
  return typographize(input).text;
}

export function typographize(input: string): TypographyResult {
  let text = input;

  // Normalize first, so quotes that are ALREADY curly get re-derived from
  // context rather than passed through. Source files accumulate a mix of
  // straight quotes, editor autocorrect, and the occasional wrong-way curly
  // typed by hand — this is what catches the wrong-way ones.
  text = text
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/ /g, " ");

  // Dashes and ellipses next — they change the characters the quote pass sees.
  text = text.replace(/---/g, "—");
  text = text.replace(/(?<!-)--(?!-)/g, "—");
  text = text.replace(/\.\s\.\s\./g, "…");
  text = text.replace(/\.{3,}/g, "…");
  // So "well..." and "well . . ." land on the same manuscript output.
  text = text.replace(/(\w)\s+…/g, "$1…");

  const out: string[] = [];
  // Double quotes alternate open/close across the paragraph rather than being
  // read from the preceding character alone. Context alone gets `He turned—"Don't."`
  // wrong, because an em dash precedes both interrupted dialogue (closing) and
  // dialogue that starts mid-sentence (opening). State resolves both.
  //
  // Resetting per paragraph is what makes the standard convention work, where
  // speech running over several paragraphs re-opens each one and closes only at
  // the end — smartTypography is called once per paragraph.
  let inDoubleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prev = i > 0 ? text[i - 1] : undefined;

    if (c === '"') {
      const next = i + 1 < text.length ? text[i + 1] : undefined;
      const opening = looksOpening(prev, next);
      const closing = looksClosing(prev, next);

      if (opening && !closing) {
        // Confidently opening. If a quote was already open, the writer forgot
        // to close it — emit an opening quote anyway and leave that one
        // dangling, so the mistake stays put instead of inverting every quote
        // after it.
        out.push("“");
        inDoubleQuote = true;
      } else if (closing && !opening) {
        out.push("”");
        inDoubleQuote = false;
      } else {
        out.push(inDoubleQuote ? "”" : "“");
        inDoubleQuote = !inDoubleQuote;
      }
    } else if (c === "'") {
      // Mid-word: an apostrophe (don't, Sam's). Otherwise an opening or
      // closing single quote depending on what precedes it — which also
      // catches the plural possessive (dogs' bowls) as a right quote.
      if (isWordChar(prev)) out.push("’");
      else if (LEADING_ELISIONS.test(text.slice(i + 1))) out.push("’");
      else if (/^\d{2}s\b/.test(text.slice(i + 1))) out.push("’"); // the ’90s
      else out.push(isOpeningContext(prev) ? "‘" : "’");
    } else {
      out.push(c);
    }
  }

  return { text: out.join(""), endsOpen: inDoubleQuote };
}

/**
 * Straight-to-typographic conversion for manuscript text.
 *
 * Runs on the whole paragraph before inline emphasis is parsed, which is safe
 * because every substitution here is character-for-character and none of them
 * touch the `*` / `_` emphasis markers.
 */

// Characters that mean a following double/single quote is an OPENING quote.
// Dashes are deliberately absent: in fiction `—"` is nearly always interrupted
// dialogue closing a quote, not the start of one.
const OPENERS = new Set(["(", "[", "{", "‘", "“", "*", "_", "/"]);

function isOpeningContext(prev: string | undefined): boolean {
  if (prev === undefined) return true;
  if (/\s/.test(prev)) return true;
  return OPENERS.has(prev);
}

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[A-Za-z0-9]/.test(c);
}

// Elisions that open with an apostrophe rather than a single quote. Without
// this list the re-curl pass turns ’em into ‘em, which looks like a stray quote.
const LEADING_ELISIONS =
  /^(?:em|tis|twas|round|cause|bout|til|till|neath|nother|way)\b/i;

export function smartTypography(input: string): string {
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
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const prev = i > 0 ? text[i - 1] : undefined;
    const next = i + 1 < text.length ? text[i + 1] : undefined;

    if (c === '"') {
      out.push(isOpeningContext(prev) ? "“" : "”");
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

  return out.join("");
}

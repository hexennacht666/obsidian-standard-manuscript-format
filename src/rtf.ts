/**
 * Renders a parsed story to Rich Text Format.
 *
 * RTF earns its place by being the one format every market in the survey
 * accepts: Clarkesworld won't take .doc, Beneath Ceaseless Skies won't take
 * .docx, and both take this. It is also the only second format producible
 * honestly in pure JavaScript — the legacy .doc is an OLE compound binary, and
 * the usual workaround (HTML wearing a .doc extension) ships a file that isn't
 * the format it claims to be.
 *
 * The same discipline as the .docx path applies here for the same reason:
 * every paragraph states its own alignment, spacing and indent, and no
 * stylesheet is emitted at all. A reader with nothing to fall back on cannot
 * fall back to the wrong thing.
 */
import type { Block, ParsedStory, Run } from "./markdown";
import {
  bylineOf,
  contactLines,
  formatWordCount,
  runningHeadPrefix,
} from "./manuscript";
import { resolveFont } from "./settings";
import type { SmfSettings } from "./settings";

const TWIPS_PER_INCH = 1440;
const INCH = TWIPS_PER_INCH;

/** US Letter, which is what Shunn's format assumes. */
const PAGE_WIDTH = Math.round(8.5 * TWIPS_PER_INCH);
const PAGE_HEIGHT = 11 * TWIPS_PER_INCH;
const MARGIN = INCH;

/** Single and double, in twips, as `\sl` expects them. */
const SINGLE = 240;
const DOUBLE = 480;

const FIRST_LINE_INDENT = Math.round(0.5 * TWIPS_PER_INCH);

/** Right-aligned tab at the right margin, for the title page banner. */
const RIGHT_TAB = PAGE_WIDTH - 2 * MARGIN;

/**
 * RTF is a 7-bit format. Control characters get escaped, and anything above
 * ASCII becomes a `\uN?` escape with a literal `?` after it as the fallback
 * for readers that don't understand Unicode escapes.
 *
 * This matters more here than it looks: the typography pass deliberately
 * produces curly quotes, em dashes and ellipses, so essentially every
 * manuscript contains characters that would otherwise be mangled.
 */
export function escapeRtf(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\\" || char === "{" || char === "}") {
      out += `\\${char}`;
    } else if (char === "\n") {
      out += "\\line ";
    } else if (code < 128) {
      out += char;
    } else if (code <= 0xffff) {
      // \uN takes a SIGNED 16-bit integer, so anything above 0x7FFF is
      // written as its negative counterpart.
      const signed = code > 0x7fff ? code - 0x10000 : code;
      out += `\\u${signed}?`;
    } else {
      // Above the BMP — emit the surrogate pair, which is what readers expect.
      const v = code - 0x10000;
      const high = 0xd800 + (v >> 10);
      const low = 0xdc00 + (v & 0x3ff);
      out += `\\u${high - 0x10000}?\\u${low - 0x10000}?`;
    }
  }
  return out;
}

/** Font and size, restated on every paragraph for the reason above. */
function face(settings: SmfSettings): string {
  return `\\f0\\fs${Math.round(settings.fontSize * 2)}`;
}

interface ParaOptions {
  align?: "left" | "center" | "right";
  spacing?: number;
  firstLineIndent?: number;
}

function paragraph(
  content: string,
  settings: SmfSettings,
  options: ParaOptions = {}
): string {
  const align =
    options.align === "center" ? "\\qc" : options.align === "right" ? "\\qr" : "\\ql";
  const spacing = options.spacing ?? SINGLE;
  const indent = options.firstLineIndent ? `\\fi${options.firstLineIndent}` : "\\fi0";
  return `\\pard\\plain${align}${indent}\\sl${spacing}\\slmult1${face(settings)} ${content}\\par\n`;
}

function runsToRtf(runs: Run[], settings: SmfSettings): string {
  return runs
    .map((run) => {
      const underline = run.italic && settings.italicsAsUnderline;
      const italic = run.italic && !settings.italicsAsUnderline;
      let out = "";
      if (run.bold) out += "\\b ";
      if (italic) out += "\\i ";
      if (underline) out += "\\ul ";
      out += escapeRtf(run.text);
      if (underline) out += "\\ulnone ";
      if (italic) out += "\\i0 ";
      if (run.bold) out += "\\b0 ";
      return out;
    })
    .join("");
}

function titlePage(story: ParsedStory, settings: SmfSettings): string {
  const contact = contactLines(settings);
  const wordCount = formatWordCount(story.wordCount, settings.roundWordCount);

  let out = "";

  // Contact block upper left, word count upper right, level on one band. The
  // .docx path needs a borderless table for this; RTF gets it from a single
  // right-aligned tab stop, which is how manuscripts have always done it.
  const first = contact.length ? escapeRtf(contact[0]) : "";
  out +=
    `\\pard\\plain\\ql\\fi0\\sl${SINGLE}\\slmult1\\tqr\\tx${RIGHT_TAB}${face(settings)} ` +
    `${first}\\tab ${escapeRtf(wordCount)}\\par\n`;

  for (const extra of contact.slice(1)) {
    out += paragraph(escapeRtf(extra), settings);
  }

  // Vertical space as empty paragraphs rather than space-before, which readers
  // honour inconsistently at the top of a page.
  for (let i = 0; i < 8; i++) out += paragraph("", settings);

  out += paragraph(escapeRtf(story.title ?? "Untitled"), settings, {
    align: "center",
  });
  out += paragraph("", settings, { spacing: DOUBLE });

  const byline = bylineOf(settings);
  out += paragraph(byline ? `by ${escapeRtf(byline)}` : "", settings, {
    align: "center",
  });

  if (settings.includeContentWarnings && story.contentWarnings.length) {
    out += paragraph("", settings, { spacing: DOUBLE });
    out += paragraph(
      escapeRtf(
        `${settings.contentWarningLabel.trim()}: ${story.contentWarnings.join(", ")}`
      ),
      settings,
      { align: "center" }
    );
  }

  return out;
}

function body(blocks: Block[], settings: SmfSettings): string {
  let out = "";
  for (const block of blocks) {
    if (block.kind === "sceneBreak") {
      out += paragraph("#", settings, { align: "center", spacing: DOUBLE });
      continue;
    }
    out += paragraph(runsToRtf(block.runs, settings), settings, {
      spacing: DOUBLE,
      firstLineIndent: FIRST_LINE_INDENT,
    });
  }

  if (settings.endMarker.trim()) {
    out += paragraph(escapeRtf(settings.endMarker.trim()), settings, {
      align: "center",
      spacing: DOUBLE,
    });
  }

  return out;
}

export function buildRtf(story: ParsedStory, settings: SmfSettings): string {
  const font = resolveFont(settings);
  const head = runningHeadPrefix(story.shortTitle, settings);

  // Page size and margins are document properties; headers belong to a section
  // and need a \sectd to attach to. Without one they bind to nothing.
  //
  // \headery puts the running head half an inch from the top, above the
  // one-inch text block, which is where Shunn's layout wants it.
  const documentProps =
    `\\paperw${PAGE_WIDTH}\\paperh${PAGE_HEIGHT}` +
    `\\margl${MARGIN}\\margr${MARGIN}\\margt${MARGIN}\\margb${MARGIN}`;

  const headerY = `\\headery${Math.round(0.5 * TWIPS_PER_INCH)}`;

  /*
   * Two sections rather than \titlepg.
   *
   * The obvious way to keep the running head off the title page is
   * \titlepg with an empty \headerf. Google Docs doesn't honour that pairing —
   * it falls back to the default header and prints the running head on the
   * title page, which is precisely what the format forbids.
   *
   * So the title page gets its own section with NO header destination at all.
   * A header that was never declared cannot be rendered by anyone, whatever
   * their support for different-first-page. \pgncont keeps the numbering
   * running across the break, so the story still opens on page 2.
   */
  const titleSection = `\\sectd${headerY}\\sbknone`;
  const bodySection = `\\sectd${headerY}\\sbkpage\\pgncont`;

  // The page number as a proper field rather than the older \chpgn control
  // word. Both mean "current page", but the field form is what modern Word
  // writes, and importers that only handle one of the two handle this one.
  // \fldrslt carries a placeholder for readers that show the cached result
  // rather than recalculating.
  const pageNumber =
    `{\\field{\\*\\fldinst PAGE }{\\fldrslt 2}}`;

  const runningHeader =
    `{\\header\\pard\\plain\\qr\\fi0\\sl${SINGLE}\\slmult1${face(settings)} ` +
    `${escapeRtf(head)}${pageNumber}\\par}`;

  // No \stylesheet is emitted on purpose. Nothing here depends on one, and a
  // reader that finds no styles cannot apply the wrong ones.
  return (
    // \uc1 states outright that one fallback character follows each \uN escape,
    // which is what this emitter writes. It is the default, but a reader that
    // assumes otherwise mangles every curly quote in the manuscript, and saying
    // it costs four characters.
    `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033\\uc1\n` +
    `{\\fonttbl{\\f0\\fnil\\fcharset0 ${escapeRtf(font)};}}\n` +
    `{\\*\\generator Standard Manuscript Format Export;}\n` +
    `\\viewkind4\n` +
    documentProps +
    "\n" +
    // Section one: the title page, carrying no header of any kind.
    titleSection +
    "\n" +
    titlePage(story, settings) +
    // Section two: the story, where the running head lives.
    "\\sect\n" +
    bodySection +
    "\n" +
    runningHeader +
    "\n" +
    body(story.blocks, settings) +
    "}\n"
  );
}

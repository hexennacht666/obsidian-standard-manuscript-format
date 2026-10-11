/**
 * Renders a parsed story to Rich Text Format.
 *
 * RTF earns its place by being accepted where the other formats are not:
 * Clarkesworld won't take .doc, Beneath Ceaseless Skies won't take .docx, and
 * both take this. It is also the only second format producible
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
  contentWarningLine,
  formatWordCount,
  hasCoverPage,
  titleGapLines,
  runningHeadPrefix,
  showsContentWarnings,
} from "./manuscript";
import {
  emphasizedText,
  halfPoints,
  LINE_SPACING_TWIPS,
  resolveFont,
  resolveLineSpacing,
} from "./settings";
import type { SmfSettings } from "./settings";

const TWIPS_PER_INCH = 1440;

/** US Letter, which is what Shunn's format assumes. */
const PAGE_WIDTH = Math.round(8.5 * TWIPS_PER_INCH);
const PAGE_HEIGHT = 11 * TWIPS_PER_INCH;
const MARGIN = TWIPS_PER_INCH;

/**
 * Single, in twips, as `\sl` expects it. The contact block and the running head
 * are always single; the manuscript itself takes the writer's chosen spacing,
 * which `resolveLineSpacing` returns in the same unit.
 */
const SINGLE = LINE_SPACING_TWIPS.single;

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
  return `\\f0\\fs${halfPoints(settings)}`;
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
      const underline = run.italic && settings.emphasis === "underline";
      const italic = run.italic && settings.emphasis === "italic";
      let out = run.break ? "\\line " : "";
      if (run.bold) out += "\\b ";
      if (italic) out += "\\i ";
      if (underline) out += "\\ul ";
      out += escapeRtf(
        run.italic ? emphasizedText(run.text, settings) : run.text
      );
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
  // honor inconsistently at the top of a page. The word count shares the first
  // contact line, so the contact block sets the band's height.
  const gap = titleGapLines(Math.max(1, contact.length), settings.fontSize);
  for (let i = 0; i < gap; i++) out += paragraph("", settings);

  // From the title on, every line takes the manuscript's spacing: the byline
  // is the next line after the title, then one blank line before what
  // follows. An anonymous manuscript has no byline line at all.
  const spacing = resolveLineSpacing(settings);
  out += paragraph(escapeRtf(story.title), settings, { align: "center", spacing });

  const byline = bylineOf(settings);
  if (byline) {
    out += paragraph(`by ${escapeRtf(byline)}`, settings, { align: "center", spacing });
  }
  out += paragraph("", settings, { spacing });

  if (showsContentWarnings("titlePage", story.contentWarnings, settings)) {
    out += paragraph(
      escapeRtf(contentWarningLine(story.contentWarnings, settings)),
      settings,
      { align: "center", spacing }
    );
    out += paragraph("", settings, { spacing });
  }

  return out;
}

function body(blocks: Block[], warnings: string[], settings: SmfSettings): string {
  let out = "";
  const spacing = resolveLineSpacing(settings);

  // Before the first line and set apart from it, as on the .docx side.
  if (showsContentWarnings("story", warnings, settings)) {
    out += paragraph(escapeRtf(contentWarningLine(warnings, settings)), settings, {
      align: "center",
      spacing,
    });
    out += paragraph("", settings, { spacing });
  }

  for (const block of blocks) {
    if (block.kind === "sceneBreak") {
      out += paragraph("#", settings, { align: "center", spacing });
      continue;
    }
    if (block.kind === "sceneLabel") {
      out += paragraph(runsToRtf(block.runs, settings), settings, {
        align: "center",
        spacing,
      });
      continue;
    }
    out += paragraph(runsToRtf(block.runs, settings), settings, {
      spacing,
      firstLineIndent: FIRST_LINE_INDENT,
    });
  }

  if (settings.endMarker.trim()) {
    out += paragraph(escapeRtf(settings.endMarker.trim()), settings, {
      align: "center",
      spacing,
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
   * Keeping the running head off page 1. Word is the reader that matters here:
   * the markets that refuse .docx open the .rtf in Word. Pages never shows an
   * RTF header at all, and Google Docs prints it on page 1 whatever this does.
   *
   * When the story starts under the byline, page 1 and page 2 are one section,
   * so the first page is told apart with \titlepg and an empty \headerf.
   *
   * An identified cover page is a section of its own that declares no header,
   * and the story's section, which carries the running head, starts on a new
   * page with numbering continued so the head opens at 2. \titlepg must not be
   * added to that arrangement: it makes the story's section treat its own first
   * page as special, and page 2 loses its running head.
   */
  const coverSection = `\\sectd${headerY}\\sbknone`;
  const bodySection = `\\sectd${headerY}\\sbkpage\\pgncont`;
  const singleSection = `\\sectd${headerY}\\titlepg`;

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

  const firstPageHeader = `{\\headerf\\pard\\plain\\qr\\fi0\\sl${SINGLE}\\slmult1${face(settings)} \\par}`;

  const pages = hasCoverPage(settings)
    ? // The cover page, carrying no header of any kind, then the story.
      coverSection +
      "\n" +
      titlePage(story, settings) +
      "\\sect\n" +
      bodySection +
      "\n" +
      runningHeader +
      "\n" +
      body(story.blocks, story.contentWarnings, settings)
    : singleSection +
      "\n" +
      firstPageHeader +
      "\n" +
      runningHeader +
      "\n" +
      titlePage(story, settings) +
      body(story.blocks, story.contentWarnings, settings);

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
    pages +
    "}\n"
  );
}

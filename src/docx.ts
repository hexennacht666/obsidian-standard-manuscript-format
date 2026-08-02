import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  LineRuleType,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { Block, ParsedStory, Run } from "./markdown";
import { resolveFont } from "./settings";
import type { SmfSettings } from "./settings";

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
};

const SINGLE = { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 0 };
const DOUBLE = { line: 480, lineRule: LineRuleType.AUTO, before: 0, after: 0 };

function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "AUTHOR";
}

export function formatWordCount(count: number, round: boolean): string {
  const n = round && count >= 100 ? Math.round(count / 100) * 100 : count;
  return `about ${n.toLocaleString("en-US")} words`;
}

// Letter, one inch each side. The table grid needs a real measurement, not a
// percentage — Word lays out from the grid and a bad one collapses the columns.
const CONTENT_WIDTH = convertInchesToTwip(6.5);
const HALF_WIDTH = Math.floor(CONTENT_WIDTH / 2);

function toTextRuns(runs: Run[], settings: SmfSettings): TextRun[] {
  const font = resolveFont(settings);
  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        // Named on every run rather than left to docDefaults, which not every
        // reader honours — a manuscript silently rendered in Calibri is worse
        // than one that never claimed a font at all.
        font,
        bold: r.bold,
        italics: r.italic && !settings.italicsAsUnderline,
        underline:
          r.italic && settings.italicsAsUnderline
            ? { type: UnderlineType.SINGLE }
            : undefined,
      })
  );
}

/** A paragraph whose font is stated outright, for the same reason. */
function line(
  text: string,
  settings: SmfSettings,
  options: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacing?: object;
    indent?: object;
  } = {}
): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: resolveFont(settings) })],
    alignment: options.alignment,
    spacing: options.spacing ?? SINGLE,
    indent: options.indent,
  });
}

function contactLines(settings: SmfSettings): string[] {
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

function titlePage(story: ParsedStory, settings: SmfSettings): (Paragraph | Table)[] {
  const contact = contactLines(settings).map((text) => line(text, settings));
  if (!contact.length) contact.push(line("", settings));

  // Shunn wants the contact block and the word count on the same visual band —
  // upper left and upper right. A borderless two-column table is the only way
  // to hold them level regardless of how many contact lines there are.
  //
  // Widths are absolute twips, and columnWidths sets the grid explicitly.
  // Percentages produced a grid of 100 twips per column and collapsed the
  // whole banner into a two-character strip.
  const banner = new Table({
    columnWidths: [HALF_WIDTH, HALF_WIDTH],
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: HALF_WIDTH, type: WidthType.DXA },
            borders: NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: contact,
          }),
          new TableCell({
            width: { size: HALF_WIDTH, type: WidthType.DXA },
            borders: NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              line(
                formatWordCount(story.wordCount, settings.roundWordCount),
                settings,
                { alignment: AlignmentType.RIGHT }
              ),
            ],
          }),
        ],
      }),
    ],
  });

  const byline = settings.penName || settings.legalName;

  return [
    banner,
    line(story.title ?? "Untitled", settings, {
      alignment: AlignmentType.CENTER,
      spacing: { ...SINGLE, before: convertInchesToTwip(2.5) },
    }),
    line("", settings, { spacing: DOUBLE }),
    line(byline ? `by ${byline}` : "", settings, {
      alignment: AlignmentType.CENTER,
    }),
    // On the title page, where a slush reader meets them before the story, and
    // off the manuscript pages themselves.
    ...(settings.includeContentWarnings && story.contentWarnings.length
      ? [
          line("", settings, { spacing: DOUBLE }),
          line(
            `${settings.contentWarningLabel.trim()}: ${story.contentWarnings.join(", ")}`,
            settings,
            { alignment: AlignmentType.CENTER }
          ),
        ]
      : []),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function bodyParagraphs(
  blocks: Block[],
  settings: SmfSettings
): Paragraph[] {
  const out: Paragraph[] = [];
  for (const block of blocks) {
    if (block.kind === "sceneBreak") {
      out.push(
        line("#", settings, { alignment: AlignmentType.CENTER, spacing: DOUBLE })
      );
      continue;
    }
    out.push(
      new Paragraph({
        children: toTextRuns(block.runs, settings),
        spacing: DOUBLE,
        indent: { firstLine: convertInchesToTwip(0.5) },
      })
    );
  }

  if (settings.endMarker.trim()) {
    out.push(
      line(settings.endMarker.trim(), settings, {
        alignment: AlignmentType.CENTER,
        spacing: DOUBLE,
      })
    );
  }

  return out;
}

export function buildManuscript(
  story: ParsedStory,
  settings: SmfSettings
): Document {
  const surname = surnameOf(settings.penName || settings.legalName || "");
  const runningHead = `${surname} / ${story.shortTitle ?? "UNTITLED"} / `;

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: resolveFont(settings), size: settings.fontSize * 2 },
          paragraph: { spacing: SINGLE },
        },
      },
      // docDefaults alone was not enough: with no Normal style present, readers
      // fall back to their own built-in Normal and the manuscript arrives in
      // Calibri. Define it explicitly as well as naming the font on every run.
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          quickFormat: true,
          run: { font: resolveFont(settings), size: settings.fontSize * 2 },
          paragraph: { spacing: SINGLE },
        },
      ],
    },
    sections: [
      {
        properties: {
          // The title page carries no running head; numbering still counts it,
          // so the story's first page is 2 — which is what Shunn specifies.
          titlePage: true,
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          first: new Header({ children: [new Paragraph({ text: "" })] }),
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: SINGLE,
                children: [
                  new TextRun({ text: runningHead }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...titlePage(story, settings),
          ...bodyParagraphs(story.blocks, settings),
        ],
      },
    ],
  });
}

export async function packDocument(doc: Document): Promise<ArrayBuffer> {
  // toBlob rather than toBuffer: no Node Buffer, so this works on mobile too.
  const blob = await Packer.toBlob(doc);
  return blob.arrayBuffer();
}

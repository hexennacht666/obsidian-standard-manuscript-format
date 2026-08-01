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

function toTextRuns(runs: Run[], settings: SmfSettings): TextRun[] {
  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic && !settings.italicsAsUnderline,
        underline:
          r.italic && settings.italicsAsUnderline
            ? { type: UnderlineType.SINGLE }
            : undefined,
      })
  );
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
  const contact = contactLines(settings).map(
    (line) => new Paragraph({ text: line, spacing: SINGLE })
  );
  if (!contact.length) contact.push(new Paragraph({ text: "", spacing: SINGLE }));

  // Shunn wants the contact block and the word count on the same visual band —
  // upper left and upper right. A borderless two-column table is the only way
  // to hold them level regardless of how many contact lines there are.
  const banner = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: contact,
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              new Paragraph({
                text: formatWordCount(story.wordCount, settings.roundWordCount),
                alignment: AlignmentType.RIGHT,
                spacing: SINGLE,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const byline = settings.penName || settings.legalName;

  return [
    banner,
    new Paragraph({
      text: story.title ?? "Untitled",
      alignment: AlignmentType.CENTER,
      spacing: { ...SINGLE, before: convertInchesToTwip(2.5) },
    }),
    new Paragraph({ text: "", spacing: DOUBLE }),
    new Paragraph({
      text: byline ? `by ${byline}` : "",
      alignment: AlignmentType.CENTER,
      spacing: SINGLE,
    }),
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
        new Paragraph({
          text: "#",
          alignment: AlignmentType.CENTER,
          spacing: DOUBLE,
        })
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
      new Paragraph({
        text: settings.endMarker.trim(),
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

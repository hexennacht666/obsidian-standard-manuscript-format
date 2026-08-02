import {
  AlignmentType,
  Document,
  Header,
  LineRuleType,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  convertInchesToTwip,
} from "docx";
import type { Block, ParsedStory, Run } from "./markdown";
import { resolveFont } from "./settings";
import type { SmfSettings } from "./settings";

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

function titlePage(story: ParsedStory, settings: SmfSettings): Paragraph[] {
  const contact = contactLines(settings).map((text) => line(text, settings));
  if (!contact.length) contact.push(line("", settings));

  const byline = settings.penName || settings.legalName;

  // Stacked paragraphs, not a table.
  //
  // Shunn's own layout puts the contact block and word count on one visual
  // band, and a borderless table is the only way to hold them level. But a
  // table is the single most fragile thing in a .docx — the first attempt
  // collapsed to a two-character column — and word processors disagree about
  // how to render one. Scrivener, whose output these manuscripts are measured
  // against, doesn't use a table either: contact block left, word count
  // right-aligned below it, blank lines to push the title down. Plain
  // paragraphs render identically everywhere, which matters more here than
  // matching the diagram exactly.
  return [
    ...contact,
    line("", settings),
    line(formatWordCount(story.wordCount, settings.roundWordCount), settings, {
      alignment: AlignmentType.RIGHT,
    }),
    // Vertical space as empty paragraphs rather than `spacing before`, which
    // readers honour inconsistently at the top of a page.
    ...Array.from({ length: 8 }, () => line("", settings)),
    line(story.title ?? "Untitled", settings, {
      alignment: AlignmentType.CENTER,
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

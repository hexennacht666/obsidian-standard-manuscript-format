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
  WidthType,
  UnderlineType,
  convertInchesToTwip,
} from "docx";
import JSZip from "jszip";
import type { Block, ParsedStory, Run } from "./markdown";
import {
  contactLines,
  formatWordCount,
  runningHeadPrefix,
} from "./manuscript";
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

// Letter minus one-inch margins. The grid needs a real measurement: sizing the
// columns as percentages made the library emit a grid of 100 twips each and
// collapsed the banner to a two-character strip.
const CONTENT_WIDTH = convertInchesToTwip(6.5);
const HALF_WIDTH = Math.floor(CONTENT_WIDTH / 2);

const SINGLE = { line: 240, lineRule: LineRuleType.AUTO, before: 0, after: 0 };
const DOUBLE = { line: 480, lineRule: LineRuleType.AUTO, before: 0, after: 0 };

function toTextRuns(runs: Run[], settings: SmfSettings): TextRun[] {
  const font = resolveFont(settings);
  const size = settings.fontSize * 2;
  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        // Font AND size on every run. Left to the defaults, Pages renders the
        // manuscript in its own Normal — wrong face, wrong size.
        font,
        size,
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
    children: [
      new TextRun({
        text,
        font: resolveFont(settings),
        size: settings.fontSize * 2,
      }),
    ],
    alignment: options.alignment,
    spacing: options.spacing ?? SINGLE,
    indent: options.indent,
  });
}

function titlePage(story: ParsedStory, settings: SmfSettings): (Paragraph | Table)[] {
  const contact = contactLines(settings).map((text) => line(text, settings));
  if (!contact.length) contact.push(line("", settings));

  const byline = settings.penName || settings.legalName;

  // Contact block and word count share one visual band — upper left and upper
  // right — as Shunn's layout specifies and as Scrivener's manuscripts do. A
  // borderless single-row table is the only way to hold them level whatever the
  // contact block's height. Stacking them instead left the word count adrift
  // below the address.
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

  return [
    banner,
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
  const runningHead = runningHeadPrefix(story.shortTitle, settings);

  return new Document({
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
                  // The header runs carried no properties at all, so the
                  // running head arrived in the reader's default sans-serif
                  // while the manuscript body was monospaced.
                  new TextRun({
                    text: runningHead,
                    font: resolveFont(settings),
                    size: settings.fontSize * 2,
                  }),
                  // The page number has to carry the font too, or it renders
                  // in the reader's default face — visibly heavier and wider
                  // than the Courier beside it. SimpleField takes no run
                  // properties, so the field goes inside a styled run instead.
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: resolveFont(settings),
                    size: settings.fontSize * 2,
                  }),
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

/**
 * Removes `word/styles.xml` from the package.
 *
 * Pages discards every direct paragraph property — alignment, line spacing,
 * indents — from any document that contains a styles part. Verified by
 * bisection: the same document renders correctly with the part removed, and
 * incorrectly with it present, even when the part is completely EMPTY. So it
 * isn't the content of the styles; it's the existence of the part.
 *
 * Scrivener's manuscripts ship no styles part either, which is why they render
 * correctly in Pages and ours did not. Nothing is lost: every run states its
 * own font and size, and every paragraph its own spacing, indent and alignment,
 * so there is nothing left for a style to supply.
 */
async function stripStylesPart(zipped: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(zipped);
  if (!zip.file("word/styles.xml")) return zipped;

  zip.remove("word/styles.xml");

  // A part that no longer exists must not be advertised, or the package is
  // inconsistent and stricter readers than Pages will object.
  const contentTypes = await zip.file("[Content_Types].xml")?.async("string");
  if (contentTypes) {
    zip.file(
      "[Content_Types].xml",
      contentTypes.replace(/<Override[^>]*word\/styles\.xml[^>]*\/>/g, "")
    );
  }

  const rels = await zip.file("word/_rels/document.xml.rels")?.async("string");
  if (rels) {
    zip.file(
      "word/_rels/document.xml.rels",
      rels.replace(/<Relationship[^>]*Target="styles\.xml"[^>]*\/>/g, "")
    );
  }

  // JSZip stores uncompressed unless told otherwise, and a .docx is a zip by
  // definition — repacking without this turned every manuscript into three
  // times the bytes it needed, which is the sort of thing that only shows up
  // once the files are sitting in someone's synced vault.
  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function packDocument(doc: Document): Promise<ArrayBuffer> {
  // toBlob rather than toBuffer: no Node Buffer, so this works on mobile too.
  const blob = await Packer.toBlob(doc);
  return stripStylesPart(await blob.arrayBuffer());
}

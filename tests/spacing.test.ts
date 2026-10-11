import { strict as assert } from "assert";
import { test } from "node:test";
import JSZip from "jszip";
import { buildManuscript, packDocument } from "../src/docx";
import { parseStory } from "../src/markdown";
import { buildRtf } from "../src/rtf";
import {
  DEFAULT_SETTINGS,
  resolveLineSpacing,
  type SmfSettings,
} from "../src/settings";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
};

const STORY = "# The Salt Year\n\nA paragraph.\n\n#\n\nAnother paragraph.\n";

function rtf(overrides: Partial<SmfSettings> = {}): string {
  const merged = { ...settings, ...overrides };
  return buildRtf(parseStory(STORY, "Untitled story"), merged);
}

async function docxXml(overrides: Partial<SmfSettings> = {}): Promise<string> {
  const merged = { ...settings, ...overrides };
  const packed = await packDocument(
    buildManuscript(parseStory(STORY, "Untitled story"), merged)
  );
  const zip = await JSZip.loadAsync(packed);
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

test("double is the default, and it is Shunn's", () => {
  assert.equal(resolveLineSpacing(settings), 480);
  assert.equal(DEFAULT_SETTINGS.lineSpacing, "double");
});

// Lightspeed states single-spaced in preference to Shunn.
test("single resolves to single, in twips", () => {
  assert.equal(resolveLineSpacing({ ...settings, lineSpacing: "single" }), 240);
});

test("RTF body paragraphs carry the chosen spacing", () => {
  assert.match(rtf(), /\\fi720\\sl480\\slmult1/);
  assert.match(rtf({ lineSpacing: "single" }), /\\fi720\\sl240\\slmult1/);
  assert.doesNotMatch(rtf({ lineSpacing: "single" }), /\\sl480/);
});

// A scene break is part of the manuscript, so it takes the body's spacing.
test("RTF scene breaks and the end marker follow the body", () => {
  const single = rtf({ lineSpacing: "single" });
  assert.equal(single.includes("\\qc\\fi0\\sl240\\slmult1\\f0\\fs24 #\\par"), true);
});

// The contact block is a stack of address lines, not prose. No market has
// asked for it opened out, and doubling it pushes the title page off shape.
test("the RTF contact block stays single whatever the body does", () => {
  const single = rtf({ lineSpacing: "single" });
  const double = rtf();
  for (const out of [single, double]) {
    // The banner line — name at the left tab, word count at the right one.
    assert.match(out, /\\sl240\\slmult1\\tqr\\tx9360\\f0\\fs24 Ursula Le Guin\\tab/);
    // And the address lines beneath it.
    assert.match(out, /\\ql\\fi0\\sl240\\slmult1\\f0\\fs24 123 Example Street/);
  }
});

test("the RTF running head stays single whatever the body does", () => {
  assert.match(rtf({ lineSpacing: "single" }), /\{\\header\\pard\\plain\\qr\\fi0\\sl240/);
  assert.match(rtf(), /\{\\header\\pard\\plain\\qr\\fi0\\sl240/);
});

test("docx body paragraphs carry the chosen spacing", async () => {
  const double = await docxXml();
  assert.match(double, /w:line="480"/);

  const single = await docxXml({ lineSpacing: "single" });
  assert.match(single, /w:line="240"/);
  // The header and the contact block are still single, so 240 alone proves
  // nothing — what matters is that no double-spaced paragraph survives.
  assert.doesNotMatch(single, /w:line="480"/);
});

test("a fractional font size rounds to the same half-point in both formats", async () => {
  const sized: SmfSettings = { ...DEFAULT_SETTINGS, legalName: "Ursula Le Guin", fontSize: 11.3 };
  const story = parseStory("# The Salt Year\n\nProse.\n", "fn");
  const zip = await JSZip.loadAsync(await packDocument(buildManuscript(story, sized)));
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const header = Object.keys(zip.files).filter((f) => /word\/header\d*\.xml/.test(f));
  const headers = await Promise.all(header.map((f) => zip.file(f)!.async("string")));
  for (const part of [xml, ...headers]) {
    for (const [, size] of part.matchAll(/<w:sz w:val="([^"]+)"/g)) assert.equal(size, "23");
  }
  assert.match(xml, /<w:sz w:val="23"/);
  assert.match(buildRtf(story, sized), /\\fs23/);
});

test("a line break inside a paragraph keeps the run's font and size", async () => {
  const story = parseStory("First line,\nsecond line.\n", "fn");
  const zip = await JSZip.loadAsync(
    await packDocument(buildManuscript(story, { ...DEFAULT_SETTINGS, legalName: "Ursula Le Guin" }))
  );
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const run = /<w:r>(?:(?!<\/w:r>)[\s\S])*<w:br\/>(?:(?!<\/w:r>)[\s\S])*<\/w:r>/.exec(xml)?.[0] ?? "";
  assert.match(run, /second line\./);
  assert.match(run, /<w:rFonts w:ascii="Times New Roman"/);
  assert.match(run, /<w:sz w:val="24"/);
  assert.equal(xml.split("<w:br/>").length - 1, 1);
});

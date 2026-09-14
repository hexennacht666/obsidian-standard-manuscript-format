import { strict as assert } from "assert";
import { test } from "node:test";
import JSZip from "jszip";
import { buildManuscript, packDocument } from "../src/docx";
import { parseStory } from "../src/markdown";
import { buildRtf } from "../src/rtf";
import { DEFAULT_SETTINGS, type SmfSettings } from "../src/settings";

// A dual-timeline story labels its sections. The first heading is the title;
// every later heading is a scene label, printed centered where a #
// would go. Shunn has no rule for these ("you could simply label it 'Earlier'
// or '1987'"); centered plain text is the convention, and it's what Scrivener's
// manuscript compile prints.
const STORY = "# The Salt Year\n\nOne.\n\n## 1987\n\nTwo.\n\n***\n\n## Now\n\nThree.\n";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
};

test("later headings become scene labels with their text kept", () => {
  const s = parseStory(STORY, "fn");
  assert.equal(s.title, "The Salt Year");
  assert.deepEqual(
    s.blocks.map((b) => (b.kind === "sceneLabel" ? "sceneLabel:" + b.runs[0].text : b.kind)),
    ["para", "sceneLabel:1987", "para", "sceneLabel:Now", "para"]
  );
});

test("a marker directly before a sceneLabel is redundant and dropped", () => {
  const s = parseStory("# T\n\nOne.\n\n#\n\n## Later\n\nTwo.\n", "fn");
  assert.deepEqual(s.blocks.map((b) => b.kind), ["para", "sceneLabel", "para"]);
});

test("a trailing sceneLabel is an artifact, like a trailing scene break", () => {
  const s = parseStory("# T\n\nOne.\n\n## Later\n\n", "fn");
  assert.deepEqual(s.blocks.map((b) => b.kind), ["para"]);
});

test("sceneLabel text is typographized and can carry italics", () => {
  const s = parseStory("# T\n\nOne.\n\n## The *Marie Celeste* — after\n\nTwo.\n", "fn");
  const sub = s.blocks[1];
  assert.equal(sub.kind, "sceneLabel");
  if (sub.kind !== "sceneLabel") return;
  assert.deepEqual(sub.runs.map((r) => [r.text, !!r.italic]), [
    ["The ", false],
    ["Marie Celeste", true],
    [" — after", false],
  ]);
});

test("sceneLabel words are counted, as a word processor would", () => {
  assert.equal(parseStory(STORY, "fn").wordCount, 5);
});

test("docx prints a scene label centered, with no first-line indent, and no #", async () => {
  const packed = await packDocument(buildManuscript(parseStory(STORY, "fn"), settings));
  const zip = await JSZip.loadAsync(packed);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const paras = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) ?? [];
  const sub = paras.find((p) => p.includes(">1987<"));
  assert.ok(sub, "the sceneLabel is a paragraph of its own");
  assert.ok(sub!.includes('<w:jc w:val="center"/>'), "centered");
  assert.ok(!sub!.includes("w:firstLine"), "no first-line indent");
  assert.ok(!paras.some((p) => p.includes(">#<")), "no # for titled breaks");
});

test("rtf prints a scene label centered, with no first-line indent, and no #", () => {
  const rtf = buildRtf(parseStory(STORY, "fn"), settings);
  const idx = rtf.indexOf("1987");
  assert.ok(idx > 0);
  const para = rtf.slice(rtf.lastIndexOf("\\pard", idx), idx);
  assert.ok(para.includes("\\qc"), "centered");
  assert.ok(!para.includes("\\fi720"), "no first-line indent");
  assert.ok(!/\\qc\s*#\\/.test(rtf) && !rtf.includes("\\qc #"), "no # for titled breaks");
});

// A note with no H1 takes its title from the filename (Obsidian's convention),
// and its scene labels start on line one. None of them is the title.
test("no H1: the first H2 is a scene label, not the title", () => {
  const s = parseStory("## Before\n\nOne.\n\n## After\n\nTwo.\n\n## Before\n\nThree.\n", "Perfumed Gloves");
  assert.equal(s.title, "Perfumed Gloves");
  assert.equal(s.heading, null);
  assert.deepEqual(
    s.blocks.map((b) => (b.kind === "sceneLabel" ? "label:" + b.runs[0].text : b.kind)),
    ["label:Before", "para", "label:After", "para", "label:Before", "para"]
  );
});

test("an H2 that repeats the filename is the title heading, not a label", () => {
  const s = parseStory("## Perfumed Gloves\n\nOne.\n\n## After\n\nTwo.\n", "Perfumed Gloves");
  assert.equal(s.heading, "Perfumed Gloves");
  assert.deepEqual(s.blocks.map((b) => b.kind), ["para", "sceneLabel", "para"]);
});

test("an H2 that repeats the frontmatter Title is the title heading", () => {
  const s = parseStory("---\ntitle: Who Goes There?\n---\n## Who goes there?\n\nOne.\n\n## Later\n\nTwo.\n", "fn");
  assert.equal(s.title, "Who Goes There?");
  assert.deepEqual(s.blocks.map((b) => b.kind), ["para", "sceneLabel", "para"]);
});

test("an H1 after labels is still just a label", () => {
  const s = parseStory("# T\n\nOne.\n\n# Part Two\n\nTwo.\n", "fn");
  assert.equal(s.heading, "T");
  assert.deepEqual(s.blocks.map((b) => b.kind), ["para", "sceneLabel", "para"]);
});

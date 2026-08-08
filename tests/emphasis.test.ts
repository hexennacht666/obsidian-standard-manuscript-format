import { strict as assert } from "assert";
import { test } from "node:test";
import JSZip from "jszip";
import { buildManuscript, packDocument } from "../src/docx";
import { parseStory } from "../src/markdown";
import { buildRtf } from "../src/rtf";
import {
  DEFAULT_SETTINGS,
  emphasisedText,
  type SmfSettings,
} from "../src/settings";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  email: "you@example.com",
};

const STORY = "# The Salt Year\n\nShe was *quite* certain.\n";

function rtf(overrides: Partial<SmfSettings> = {}): string {
  return buildRtf(parseStory(STORY, "fn"), { ...settings, ...overrides });
}

async function docxXml(overrides: Partial<SmfSettings> = {}): Promise<string> {
  const packed = await packDocument(
    buildManuscript(parseStory(STORY, "fn"), { ...settings, ...overrides })
  );
  const zip = await JSZip.loadAsync(packed);
  return (await zip.file("word/document.xml")?.async("string")) ?? "";
}

test("italics are the default, and stay formatting", async () => {
  assert.equal(DEFAULT_SETTINGS.emphasis, "italic");

  const xml = await docxXml();
  // `<w:i/>` is italics on; `<w:i w:val="false"/>` is the library stating they
  // are off, which it emits either way — so the bare form is the assertion.
  assert.match(xml, /<w:i\/>/);
  assert.doesNotMatch(xml, /_quite_/);

  assert.match(rtf(), /\\i quite/);
});

test("underline is the typewriter convention, and also formatting", async () => {
  const xml = await docxXml({ emphasis: "underline" });
  assert.match(xml, /<w:u w:val="single"\/>/);
  assert.doesNotMatch(xml, /<w:i\/>/);
  assert.doesNotMatch(xml, /_quite_/);

  const out = rtf({ emphasis: "underline" });
  assert.match(out, /\\ul quite/);
  assert.doesNotMatch(out, /\\i quite/);
});

// Escape Pod asks for emphasis written as _italics_ — the only mode that puts
// characters into the prose rather than formatting on it.
test("underscores reach the page as characters, with no formatting at all", async () => {
  const xml = await docxXml({ emphasis: "underscore" });
  assert.match(xml, /_quite_/);
  assert.doesNotMatch(xml, /<w:i\/>/);
  assert.doesNotMatch(xml, /<w:u w:val="single"\/>/);

  const out = rtf({ emphasis: "underscore" });
  assert.match(out, /_quite_/);
  assert.doesNotMatch(out, /\\i quite/);
  assert.doesNotMatch(out, /\\ul quite/);
});

test("only emphasised runs get underscores", () => {
  const out = rtf({ emphasis: "underscore" });
  assert.match(out, /She was _quite_ certain\./);
});

// A run's edges routinely carry the space between it and the next word, and
// "_ word _" is not what anyone means by emphasis.
test("the marks hug the words, not the whitespace", () => {
  const underscore: SmfSettings = { ...settings, emphasis: "underscore" };
  assert.equal(emphasisedText(" quite ", underscore), " _quite_ ");
  assert.equal(emphasisedText("quite", underscore), "_quite_");
  assert.equal(emphasisedText("   ", underscore), "   ");
  assert.equal(emphasisedText("", underscore), "");
});

test("the other modes never touch the text", () => {
  for (const emphasis of ["italic", "underline"] as const) {
    assert.equal(emphasisedText(" quite ", { ...settings, emphasis }), " quite ");
  }
});

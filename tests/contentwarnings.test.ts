import { strict as assert } from "assert";
import { test } from "node:test";
import JSZip from "jszip";
import { buildManuscript, packDocument } from "../src/docx";
import { parseStory } from "../src/markdown";
import { buildRtf } from "../src/rtf";
import { DEFAULT_SETTINGS, type SmfSettings } from "../src/settings";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  email: "you@example.com",
};

const STORY = [
  "---",
  "Content warnings:",
  "  - body horror",
  "  - drowning",
  "---",
  "",
  "# The Salt Year",
  "",
  "The first line of the story.",
  "",
].join("\n");

function story() {
  return parseStory(STORY, "Untitled story");
}

function rtf(overrides: Partial<SmfSettings> = {}): string {
  return buildRtf(story(), { ...settings, ...overrides });
}

/** The document split at the page break, so "where" is answerable. */
async function docxHalves(
  overrides: Partial<SmfSettings> = {}
): Promise<{ titlePage: string; body: string }> {
  const packed = await packDocument(
    buildManuscript(story(), { ...settings, ...overrides })
  );
  const zip = await JSZip.loadAsync(packed);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const [titlePage, body] = xml.split("<w:br w:type=\"page\"/>");
  return { titlePage, body: body ?? "" };
}

function rtfHalves(overrides: Partial<SmfSettings> = {}): {
  titlePage: string;
  body: string;
} {
  // \sect ends the title page's section; the story is everything after it.
  const [titlePage, body] = rtf(overrides).split("\\sect\n");
  return { titlePage, body: body ?? "" };
}

test("the title page is where warnings go by default", async () => {
  const { titlePage, body } = await docxHalves();
  assert.match(titlePage, /Content warnings/);
  assert.doesNotMatch(body, /Content warnings/);

  const halves = rtfHalves();
  assert.match(halves.titlePage, /Content warnings/);
  assert.doesNotMatch(halves.body, /Content warnings/);
});

// Escape Pod wants them in the manuscript, before the text and set apart from
// it, so a reader who opens straight to the story still meets them first.
test("with the story means with the story, and not on the title page", async () => {
  const { titlePage, body } = await docxHalves({ contentWarningPlacement: "story" });
  assert.doesNotMatch(titlePage, /Content warnings/);
  assert.match(body, /Content warnings: body horror, drowning/);

  const halves = rtfHalves({ contentWarningPlacement: "story" });
  assert.doesNotMatch(halves.titlePage, /Content warnings/);
  assert.match(halves.body, /Content warnings: body horror, drowning/);
});

test("both means both", async () => {
  const { titlePage, body } = await docxHalves({ contentWarningPlacement: "both" });
  assert.match(titlePage, /Content warnings/);
  assert.match(body, /Content warnings/);

  const halves = rtfHalves({ contentWarningPlacement: "both" });
  assert.match(halves.titlePage, /Content warnings/);
  assert.match(halves.body, /Content warnings/);
});

test("the warnings arrive before the first line of the story", () => {
  const { body } = rtfHalves({ contentWarningPlacement: "story" });
  assert.ok(
    body.indexOf("Content warnings") < body.indexOf("The first line of the story"),
    "warnings must precede the story"
  );
});

test("turning warnings off silences every placement", async () => {
  for (const placement of ["titlePage", "story", "both"] as const) {
    const { titlePage, body } = await docxHalves({
      includeContentWarnings: false,
      contentWarningPlacement: placement,
    });
    assert.doesNotMatch(titlePage, /Content warnings/);
    assert.doesNotMatch(body, /Content warnings/);
  }
});

test("a story with no warnings prints nothing, wherever it's asked to", () => {
  const bare = parseStory("# The Salt Year\n\nA paragraph.\n", "fn");
  const out = buildRtf(bare, { ...settings, contentWarningPlacement: "both" });
  assert.doesNotMatch(out, /Content warnings/);
});

test("the label is the writer's, in both places", async () => {
  const { titlePage, body } = await docxHalves({
    contentWarningPlacement: "both",
    contentWarningLabel: "Content notes",
  });
  assert.match(titlePage, /Content notes/);
  assert.match(body, /Content notes/);
});

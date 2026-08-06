import { strict as assert } from "assert";
import { test } from "node:test";
import { parseStory } from "../src/markdown";
import { buildRtf, escapeRtf } from "../src/rtf";
import { DEFAULT_SETTINGS, type SmfSettings } from "../src/settings";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
};

function render(markdown: string, overrides: Partial<SmfSettings> = {}): string {
  const merged = { ...settings, ...overrides };
  // Parsed the way the export command parses it, so the bold setting reaches
  // the parser here too rather than only the emitter.
  const story = parseStory(markdown, "Untitled story", {
    stripBold: merged.stripBold,
  });
  return buildRtf(story, merged);
}

test("the three RTF metacharacters are escaped", () => {
  assert.equal(escapeRtf("a\\b"), "a\\\\b");
  assert.equal(escapeRtf("{x}"), "\\{x\\}");
});

test("plain ASCII passes through untouched", () => {
  assert.equal(escapeRtf("Hello, world."), "Hello, world.");
});

// The typography pass produces these deliberately, so essentially every
// manuscript contains characters RTF cannot carry literally.
test("curly quotes, em dashes and ellipses become unicode escapes", () => {
  assert.equal(escapeRtf("“wait”"), "\\u8220?wait\\u8221?");
  assert.equal(escapeRtf("a—b"), "a\\u8212?b");
  assert.equal(escapeRtf("so…"), "so\\u8230?");
  assert.equal(escapeRtf("don’t"), "don\\u8217?t");
});

test("characters above the BMP are written as a surrogate pair", () => {
  // U+1F600. Not expected in a manuscript, but it must not corrupt the file.
  const out = escapeRtf("\u{1F600}");
  assert.equal(out, "\\u-10179?\\u-8704?");
});

test("every unicode escape is a signed 16-bit value", () => {
  const body = render("She said “no” — and meant it…");
  for (const [, n] of body.matchAll(/\\u(-?\d+)\?/g)) {
    const value = Number(n);
    assert.ok(value >= -32768 && value <= 32767, `${value} out of range`);
  }
});

test("the document opens and closes as a single RTF group", () => {
  const out = render("A paragraph.");
  assert.ok(out.startsWith("{\\rtf1\\ansi"));
  assert.ok(out.trimEnd().endsWith("}"));

  let depth = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === "\\") {
      i++; // escaped character, never a group delimiter
      continue;
    }
    if (out[i] === "{") depth++;
    if (out[i] === "}") depth--;
    assert.ok(depth >= 0, "closed a group that was never opened");
  }
  assert.equal(depth, 0, "unbalanced groups");
});

test("no stylesheet is emitted, for the same reason the docx strips one", () => {
  assert.ok(!render("A paragraph.").includes("\\stylesheet"));
});

test("the running head carries the page number field", () => {
  const out = render("A paragraph.");
  assert.ok(out.includes("\\header"));
  assert.ok(out.includes("\\fldinst PAGE"));
  assert.ok(out.includes("Guin / "));
});

// Headers are section properties. Without a section to attach to they bind to
// nothing and the running head silently doesn't appear — which is exactly how
// this shipped the first time.
test("a section is opened before anything that belongs to one", () => {
  const out = render("A paragraph.");
  const sectd = out.indexOf("\\sectd");
  assert.ok(sectd !== -1, "no \\sectd");
  assert.ok(sectd < out.indexOf("{\\header"), "header precedes its section");
});

/*
 * The title page must carry no running head. Relying on \titlepg with an empty
 * \headerf was not enough — Google Docs ignored it and printed the running head
 * on the title page. The title page now lives in its own section that declares
 * no header at all, so there is nothing for any reader to fall back to.
 */
test("the title page's section declares no header", () => {
  const out = render("A paragraph.");
  const secondSection = out.indexOf("\\sect\n");
  const header = out.indexOf("{\\header");

  assert.ok(secondSection !== -1, "no second section");
  assert.ok(header > secondSection, "header is declared in the title page's section");
});

test("the story begins in a second section, on a new page", () => {
  const out = render("A paragraph.");
  assert.ok(out.includes("\\sect\n"), "no section break");
  assert.ok(out.includes("\\sbkpage"), "the break doesn't start a new page");
  assert.ok(out.includes("\\pgncont"), "numbering restarts instead of continuing");
});

// Belt and braces: a stray \page alongside the section break would leave a
// blank page between the title page and the story.
test("the section break is the only page break", () => {
  const out = render("A paragraph.");
  assert.ok(!/\\page[^a-z]/.test(out.replace(/\\pagebb/g, "")), "stray \\page");
});

test("the running head sits above the text block, not inside it", () => {
  assert.ok(render("A paragraph.").includes("\\headery720"));
});

test("the title page is separated from the story by a section break", () => {
  const out = render("A paragraph.");
  assert.ok(out.includes("\\sect\n"));
  assert.ok(out.includes("\\sbkpage"));
});

test("body paragraphs are double spaced and first-line indented", () => {
  const out = render("A paragraph.");
  assert.ok(out.includes("\\sl480"));
  assert.ok(out.includes("\\fi720"));
});

test("italics become underline when the setting asks for it", () => {
  const emphasised = "*whispered*";
  assert.ok(render(emphasised).includes("\\i "));
  assert.ok(!render(emphasised).includes("\\ul "));

  const underlined = render(emphasised, { italicsAsUnderline: true });
  assert.ok(underlined.includes("\\ul "));
  assert.ok(!underlined.includes("\\i "));
});

test("bold reaches the file only when the setting allows it", () => {
  const emphasised = "**shouted**";
  assert.ok(!render(emphasised).includes("\\b "));

  const kept = render(emphasised, { stripBold: false });
  assert.ok(kept.includes("\\b "));
  assert.ok(kept.includes("\\b0 "));
});

test("a scene break prints centred", () => {
  const out = render("One.\n\n#\n\nTwo.");
  assert.ok(out.includes("\\qc"));
});

test("content warnings print when the story carries them", () => {
  const withWarnings = render(
    "---\nContent warnings:\n  - body horror\n---\n\nA paragraph."
  );
  assert.ok(withWarnings.includes("body horror"));

  const suppressed = render(
    "---\nContent warnings:\n  - body horror\n---\n\nA paragraph.",
    { includeContentWarnings: false }
  );
  assert.ok(!suppressed.includes("body horror"));
});

test("the word count appears on the title page", () => {
  assert.ok(render("One two three four five.").includes("words"));
});

test("a curly quote in the title survives into the document", () => {
  const out = render("---\nTitle: Don’t Look\n---\n\nA paragraph.");
  assert.ok(out.includes("Don\\u8217?t Look"));
});

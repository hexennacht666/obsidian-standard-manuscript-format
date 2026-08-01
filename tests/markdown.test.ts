import { strict as assert } from "assert";
import { test } from "node:test";
import { parseInline, parseStory } from "../src/markdown";

const plain = (s: string) => parseInline(s).map((r) => r.text).join("");

test("emphasis becomes runs", () => {
  assert.deepEqual(parseInline("a *b* c"), [
    { text: "a ", italic: undefined, bold: undefined },
    { text: "b", italic: true, bold: undefined },
    { text: " c", italic: undefined, bold: undefined },
  ]);
  assert.deepEqual(parseInline("**b**")[0], {
    text: "b",
    italic: undefined,
    bold: true,
  });
  assert.deepEqual(parseInline("***b***")[0], {
    text: "b",
    italic: true,
    bold: true,
  });
});

test("underscores inside words are left alone", () => {
  assert.equal(plain("the orichalcum_clad beetle"), "the orichalcum_clad beetle");
  assert.deepEqual(parseInline("_word_")[0], {
    text: "word",
    italic: true,
    bold: undefined,
  });
});

test("escaped markers are literal", () => {
  assert.equal(plain("a \\*not italic\\* b"), "a *not italic* b");
});

test("frontmatter supplies title and short title", () => {
  const s = parseStory(
    "---\ntitle: The Salt Year\nshortTitle: SALT\n---\n\nBody text here.\n",
    "filename"
  );
  assert.equal(s.title, "The Salt Year");
  assert.equal(s.shortTitle, "SALT");
});

test("falls back to an H1, then the filename", () => {
  assert.equal(parseStory("# The Salt Year\n\nBody.\n", "fn").title, "The Salt Year");
  assert.equal(parseStory("Body.\n", "The Salt Year").title, "The Salt Year");
});

test("short title skips stopwords and picks the distinctive word", () => {
  assert.equal(parseStory("Body.\n", "Only Perfumed Gloves Would Do").shortTitle, "PERFUMED");
  assert.equal(parseStory("Body.\n", "The Salt Year").shortTitle, "SALT");
});

test("scene break markers, but not headings", () => {
  const s = parseStory("One.\n\n#\n\nTwo.\n\n***\n\nThree.\n", "fn");
  assert.deepEqual(
    s.blocks.map((b) => b.kind),
    ["para", "sceneBreak", "para", "sceneBreak", "para"]
  );
});

test("trailing and doubled scene breaks are dropped", () => {
  const s = parseStory("One.\n\n#\n\n***\n\nTwo.\n\n#\n\n", "fn");
  assert.deepEqual(s.blocks.map((b) => b.kind), ["para", "sceneBreak", "para"]);
});

test("vault syntax never reaches the manuscript", () => {
  const s = parseStory(
    "A [[Note|link]] and [text](http://x) and %%private%% and ==hl==.\n",
    "fn"
  );
  assert.equal(
    s.blocks[0].kind === "para" && s.blocks[0].runs.map((r) => r.text).join(""),
    "A link and text and and hl."
  );
});

test("soft-wrapped lines join into one paragraph", () => {
  const s = parseStory("One line\nwrapped here.\n\nSecond.\n", "fn");
  assert.equal(s.blocks.length, 2);
});

test("word count covers the body only", () => {
  const s = parseStory("---\ntitle: Ignore Me Entirely\n---\n\n# Also Ignored\n\none two three\n", "fn");
  assert.equal(s.wordCount, 3);
});

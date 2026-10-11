import { strict as assert } from "assert";
import { test } from "node:test";
import { parseInline, parseStory } from "../src/markdown";
import { DEFAULT_SETTINGS, resolveFont } from "../src/settings";

const plain = (s: string) => parseInline(s).map((r) => r.text).join("");

test("emphasis becomes runs", () => {
  assert.deepEqual(parseInline("a *b* c"), [
    { text: "a ", italic: undefined },
    { text: "b", italic: true },
    { text: " c", italic: undefined },
  ]);
});

test("bold is stripped, because the format has no bold", () => {
  // The words survive; only the emphasis is dropped, and the run either side
  // of it merges back into one rather than fragmenting the paragraph.
  assert.deepEqual(parseInline("a **b** c"), [{ text: "a b c", italic: undefined }]);
  assert.deepEqual(parseInline("**b**"), [{ text: "b", italic: undefined }]);
  // Bold-and-italic keeps the half the page can hold.
  assert.deepEqual(parseInline("***b***"), [{ text: "b", italic: true }]);
  assert.deepEqual(parseInline("__b__"), [{ text: "b", italic: undefined }]);
  // Italic nested inside bold still comes through.
  assert.deepEqual(parseInline("**a *b* c**"), [
    { text: "a ", italic: undefined },
    { text: "b", italic: true },
    { text: " c", italic: undefined },
  ]);
});

test("bold survives when the market asks for it kept", () => {
  const keep = { stripBold: false };
  assert.deepEqual(parseInline("a **b** c", keep), [
    { text: "a ", italic: undefined },
    { text: "b", italic: undefined, bold: true },
    { text: " c", italic: undefined },
  ]);
  assert.deepEqual(parseInline("__b__", keep), [
    { text: "b", italic: undefined, bold: true },
  ]);
  // `***` is both, and with bold kept both come through.
  assert.deepEqual(parseInline("***b***", keep), [
    { text: "b", italic: true, bold: true },
  ]);
  // Italic nested inside bold is two attributes on one stretch of text, so the
  // middle run carries both rather than dropping the bold around it.
  assert.deepEqual(parseInline("**a *b* c**", keep), [
    { text: "a ", italic: undefined, bold: true },
    { text: "b", italic: true, bold: true },
    { text: " c", italic: undefined, bold: true },
  ]);
});

test("underscores inside words are left alone", () => {
  assert.equal(plain("the orichalcum_clad beetle"), "the orichalcum_clad beetle");
  assert.deepEqual(parseInline("_word_")[0], {
    text: "word",
    italic: true,
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
  assert.equal(
    parseStory("Body.\n", "Only Perfumed Gloves Would Do").shortTitle,
    "Perfumed Gloves"
  );
  assert.equal(parseStory("Body.\n", "The Salt Year").shortTitle, "Salt Year");
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

test("multi-paragraph speech is never reported as unclosed", () => {
  // The convention: open every paragraph, close only the last. Reporting this
  // would fire on correctly written dialogue constantly.
  const s = parseStory(
    '"It went on for years.\n\n"And it never once stopped."\n\nShe looked away.\n',
    "fn"
  );
  assert.deepEqual(s.unclosedQuotes, []);
});

test("a genuinely unclosed quote is reported once, with its position", () => {
  const s = parseStory(
    'She spoke first.\n\n"I never meant for it to happen.\n\nHe said nothing at all.\n',
    "fn"
  );
  assert.equal(s.unclosedQuotes.length, 1);
  assert.equal(s.unclosedQuotes[0].paragraph, 2);
  assert.match(s.unclosedQuotes[0].excerpt, /never meant/);
});

test("speech left open at the very end of the story is reported", () => {
  const s = parseStory('He turned back.\n\n"You never listen to me.\n', "fn");
  assert.equal(s.unclosedQuotes.length, 1);
  assert.equal(s.unclosedQuotes[0].paragraph, 2);
});

test("clean dialogue reports nothing", () => {
  const s = parseStory(
    '"Morning," she said.\n\nHe grunted.\n\n"That all you have to say?"\n',
    "fn"
  );
  assert.deepEqual(s.unclosedQuotes, []);
});

test("word count covers the body only", () => {
  const s = parseStory("---\ntitle: Ignore Me Entirely\n---\n\n# Also Ignored\n\none two three\n", "fn");
  assert.equal(s.wordCount, 3);
});

test("font resolution across presets and custom", () => {
  const base = { ...DEFAULT_SETTINGS };
  assert.equal(resolveFont({ ...base, fontPreset: "courier" }), "Courier New");
  assert.equal(resolveFont({ ...base, fontPreset: "times" }), "Times New Roman");
  assert.equal(
    resolveFont({ ...base, fontPreset: "custom", customFont: "Georgia" }),
    "Georgia"
  );
  // Custom selected but left blank falls back rather than emitting an empty font.
  assert.equal(resolveFont({ ...base, fontPreset: "custom", customFont: "  " }), "Times New Roman");
});

test("content warnings from a YAML block list", () => {
  const s = parseStory(
    "---\ntitle: The Salt Year\ncontentWarnings:\n  - body horror\n  - animal death\n---\n\nBody.\n",
    "fn"
  );
  assert.deepEqual(s.contentWarnings, ["body horror", "animal death"]);
  assert.equal(s.title, "The Salt Year"); // the list didn't swallow the next key
});

test("content warnings inline, comma-separated, or as an array", () => {
  const one = parseStory("---\ncw: violence, grief\n---\n\nBody.\n", "fn");
  assert.deepEqual(one.contentWarnings, ["violence", "grief"]);

  const two = parseStory(
    "---\ncontent_notes: [suicide, medical detail]\n---\n\nBody.\n",
    "fn"
  );
  assert.deepEqual(two.contentWarnings, ["suicide", "medical detail"]);
});

test("no content warnings is the normal case, not an empty label", () => {
  assert.deepEqual(parseStory("Body.\n", "fn").contentWarnings, []);
  assert.deepEqual(
    parseStory("---\ntitle: X\ncw:\n---\n\nBody.\n", "fn").contentWarnings,
    []
  );
});

test("a block list is followed by keys that still parse", () => {
  const s = parseStory(
    "---\ncw:\n  - violence\nshortTitle: SALT\ntitle: The Salt Year\n---\n\nBody.\n",
    "fn"
  );
  assert.deepEqual(s.contentWarnings, ["violence"]);
  assert.equal(s.shortTitle, "SALT");
  assert.equal(s.title, "The Salt Year");
});

test("an empty frontmatter key means absent, not blank", () => {
  // What a scaffold leaves behind on a story the writer hasn't filled in yet.
  const s = parseStory(
    "---\ntitle:\nshortTitle:\ncontentWarnings: []\n---\n\nBody text here.\n",
    "My Story Filename"
  );
  assert.equal(s.title, "My Story Filename");
  assert.equal(s.shortTitle, "Story Filename");
  assert.deepEqual(s.contentWarnings, []);
});

test("an empty content-warnings key of either form yields none", () => {
  assert.deepEqual(
    parseStory("---\ncontentWarnings:\n---\n\nBody.\n", "fn").contentWarnings,
    []
  );
  assert.deepEqual(
    parseStory("---\ncontentWarnings: []\n---\n\nBody.\n", "fn").contentWarnings,
    []
  );
});

test("the running head keyword comes from the main title, not the subtitle", () => {
  assert.equal(
    parseStory("Body.\n", "The Salt Year: A Fragment").shortTitle,
    "Salt Year"
  );
  assert.equal(parseStory("Body.\n", "Wintering — A Ghost Story").shortTitle, "Wintering");
  // A title that is only a subtitle marker still yields something usable.
  assert.equal(parseStory("Body.\n", ": Fragment").shortTitle, "Fragment");
});

test("property names with spaces and any casing are one key", () => {
  const variants = [
    "Content warnings: grief, body horror",
    "content_warnings: grief, body horror",
    "CONTENT-WARNINGS: grief, body horror",
    "contentWarnings: grief, body horror",
    "Content notes: grief, body horror",
    "cw: grief, body horror",
  ];
  for (const line of variants) {
    assert.deepEqual(
      parseStory(`---\n${line}\n---\n\nBody.\n`, "fn").contentWarnings,
      ["grief", "body horror"],
      line
    );
  }
});

test("a spaced key works as a block list too", () => {
  const s = parseStory(
    "---\nContent warnings:\n  - grief\n  - body horror\nShort title: SALT\n---\n\nBody.\n",
    "fn"
  );
  assert.deepEqual(s.contentWarnings, ["grief", "body horror"]);
  assert.equal(s.shortTitle, "SALT");
});

test("indented text is never mistaken for a property", () => {
  const s = parseStory(
    "---\nContent warnings:\n  - grief\n---\n\nShe said: nothing at all.\n",
    "fn"
  );
  assert.deepEqual(s.contentWarnings, ["grief"]);
  assert.equal(
    s.blocks[0].kind === "para" && s.blocks[0].runs.map((r) => r.text).join(""),
    "She said: nothing at all."
  );
});

test("an empty Title property inherits the filename", () => {
  // Exactly what New story leaves behind.
  const s = parseStory(
    '---\nTitle: ""\nContent warnings: []\n---\n\nBody text here.\n',
    "Untitled story"
  );
  assert.equal(s.title, "Untitled story");
});

test("a filled Title property wins, punctuation and all", () => {
  // The whole reason the field exists: a filename can't hold these.
  for (const [value, expected] of [
    ["Who Goes There?", "Who Goes There?"],
    ["The Salt Year: A Fragment", "The Salt Year: A Fragment"],
    ["What/Then", "What/Then"],
  ] as [string, string][]) {
    const s = parseStory(
      `---\nTitle: "${value}"\nContent warnings: []\n---\n\nBody.\n`,
      "Some Filename"
    );
    assert.equal(s.title, expected);
  }
});

test("the running head follows the Title property, not the filename", () => {
  // A working filename bears no relation to the title often enough to matter.
  const s = parseStory(
    '---\nTitle: "The Salt Year: A Fragment"\n---\n\nBody.\n',
    "salt draft v3"
  );
  assert.equal(s.title, "The Salt Year: A Fragment");
  assert.equal(s.shortTitle, "Salt Year");
});

test("an empty content-warnings key never hides a filled one beside it", () => {
  for (const empty of ["Content warnings: []", "Content warnings: [ ]", "Content warnings:", 'cw: ""']) {
    const s = parseStory(
      `---\n${empty}\nContent notes:\n  - grief\n  - drowning\n---\n\nBody.\n`,
      "fn"
    );
    assert.deepEqual(s.contentWarnings, ["grief", "drowning"], empty);
  }
});

test("a lone asterisk is printed, not read as emphasis", () => {
  for (const text of ["What the f*ck.", "Five * three = 15, she said.", "A *dangling opener and nothing else."]) {
    assert.deepEqual(parseInline(text), [{ text, italic: undefined }], text);
  }
});

test("a lone asterisk leaves real emphasis after it intact", () => {
  assert.deepEqual(parseInline("f*ck, she *meant* it"), [
    { text: "f*ck, she ", italic: undefined },
    { text: "meant", italic: true },
    { text: " it", italic: undefined },
  ]);
});

test("a title is plain text, with markup consumed and quotes curled", () => {
  assert.equal(parseStory('# *Salt* "Year"\n\nBody.\n', "fn").title, "Salt “Year”");
  assert.equal(
    parseStory("---\ntitle: The *Salt* Year\n---\n\nBody.\n", "fn").title,
    "The Salt Year"
  );
  assert.equal(
    parseStory("---\nShort title: '*Salt*'\n---\n\nBody.\n", "fn").shortTitle,
    "Salt"
  );
});

const firstPara = (source: string) => {
  const block = parseStory(source, "fn").blocks[0];
  return block?.kind === "para" ? block.runs.map((r) => r.text).join("") : "";
};

test("embeds are dropped, not printed as their file names", () => {
  assert.equal(firstPara("She looked up. ![[moth.png]] Nothing.\n"), "She looked up. Nothing.");
  assert.equal(firstPara("Before ![a moth](moth.png) after.\n"), "Before after.");
  assert.equal(firstPara("![[Other story]]\n\nProse.\n"), "Prose.");
});

test("links to a heading or block print the note's name only", () => {
  assert.equal(firstPara("See [[Salt Year#The Shore]] again.\n"), "See Salt Year again.");
  assert.equal(firstPara("See [[Salt Year#^a1b2c3]] again.\n"), "See Salt Year again.");
  assert.equal(firstPara("See [[Salt Year#The Shore|the shore]] again.\n"), "See the shore again.");
});

test("block IDs are stripped", () => {
  assert.equal(firstPara("The tide came in. ^tide-1\n"), "The tide came in.");
  assert.equal(firstPara("The tide came in.\n^tide-1\n"), "The tide came in.");
});

test("YAML quote escapes are decoded", () => {
  const single = parseStory("---\nTitle: 'Don''t Look Back'\n---\n\nBody.\n", "fn");
  assert.equal(single.frontmatter["title"], "Don't Look Back");

  const double = parseStory(
    '---\nTitle: "The \\"Real\\" Story"\nShort title: "Back\\\\slash"\n---\n\nBody.\n',
    "fn"
  );
  assert.equal(double.frontmatter["title"], 'The "Real" Story');
  assert.equal(double.frontmatter["shorttitle"], "Back\\slash");

  const list = parseStory("---\nContent warnings:\n  - 'a child''s death'\n---\n\nBody.\n", "fn");
  assert.deepEqual(list.contentWarnings, ["a child's death"]);
});

test("the manuscript never opens with a scene break", () => {
  const kinds = (source: string) => parseStory(source, "fn").blocks.map((b) => b.kind);
  assert.deepEqual(kinds("# The Salt Year\n\n***\n\nProse.\n"), ["para"]);
  assert.deepEqual(kinds("---\n---\n\nProse.\n"), ["para"]);
  assert.deepEqual(kinds("﻿---\ntitle: The Salt Year\n---\n\nProse.\n"), ["para"]);
});

test("empty frontmatter and a byte-order mark still read as frontmatter", () => {
  const bom = parseStory("﻿---\ntitle: The Salt Year\n---\n\nProse.\n", "fn");
  assert.equal(bom.title, "The Salt Year");
  assert.equal(bom.wordCount, 1);
  assert.equal(parseStory("---\n---\nProse.\n", "fn").wordCount, 1);
});

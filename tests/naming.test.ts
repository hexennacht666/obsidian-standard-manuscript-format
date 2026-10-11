import { strict as assert } from "assert";
import { test } from "node:test";
import { parseStory } from "../src/markdown";
import { exportBasename, storyName, uniquePath } from "../src/naming";

test("unique paths step around what already exists", () => {
  const taken = new Set(["Stories/The Salt Year.md", "Stories/The Salt Year 2.md"]);
  assert.equal(
    uniquePath("Stories", "The Salt Year", (p) => taken.has(p)),
    "Stories/The Salt Year 3.md"
  );
});

test("an empty folder means the vault root", () => {
  assert.equal(uniquePath("", "The Salt Year", () => false), "The Salt Year.md");
});

/** The filename the manuscript would be written under, end to end. */
function exportedAs(basename: string, source: string): string {
  return exportBasename(basename, storyName(parseStory(source, basename)));
}

test("a note the writer named keeps its name", () => {
  // Variants of one story are distinguished by filename alone and share a
  // title, so naming exports from the title would overwrite one with the other.
  assert.equal(
    exportedAs("Salt Year v2", "---\ntitle: The Salt Year\n---\n\n# The Salt Year\n\nProse.\n"),
    "Salt Year v2"
  );
});

test("the opening heading names it, exactly as written", () => {
  // Obsidian's own convention: the first heading and the note's name are the
  // same thing. Verbatim, not the running head's keywords.
  assert.equal(
    exportedAs("Untitled story", "# Only Perfumed Gloves Would Do\n\nProse.\n"),
    "Only Perfumed Gloves Would Do"
  );
});

test("a heading that repeats the stated title wins over both properties", () => {
  assert.equal(
    exportedAs(
      "Untitled 3",
      "---\ntitle: Only Perfumed Gloves\nShort title: Gloves\n---\n\n# Only Perfumed Gloves\n\nProse.\n"
    ),
    "Only Perfumed Gloves"
  );
});

test("a stated title wins over a heading that doesn't match it", () => {
  assert.equal(
    exportedAs("Untitled story", "---\ntitle: The Salt Year\n---\n\n# Draft notes\n\nProse.\n"),
    "The Salt Year"
  );
  assert.equal(
    exportedAs(
      "Untitled 3",
      "---\ntitle: The Salt Year\nShort title: Salt\n---\n\n# Draft notes\n\nProse.\n"
    ),
    "Salt"
  );
});

test("with no heading, a stated short title names it", () => {
  assert.equal(
    exportedAs(
      "Untitled story",
      "---\ntitle: Only Perfumed Gloves Would Do\nShort title: Gloves\n---\n\nProse.\n"
    ),
    "Gloves"
  );
});

test("with neither, the title names it, exactly as written", () => {
  // A title too long to be a filename is what Short title is for, and it is
  // asked for first.
  assert.equal(
    exportedAs(
      "Untitled story",
      "---\ntitle: Only Perfumed Gloves Would Do\n---\n\nProse.\n"
    ),
    "Only Perfumed Gloves Would Do"
  );
});

test("a story with no title anywhere keeps the placeholder", () => {
  // Nothing to name it from. The export notice is what tells the writer.
  assert.equal(exportedAs("Untitled story", "Prose.\n"), "Untitled story");
  assert.equal(exportedAs("Untitled 3", "---\ntitle:\n---\n\nProse.\n"), "Untitled 3");
});

test("a placeholder in the frontmatter is not a name either", () => {
  assert.equal(exportedAs("Untitled", "# Untitled story\n\nProse.\n"), "Untitled");
});

test("Obsidian's placeholders and New story's are both recognised", () => {
  const named = (b: string) =>
    exportBasename(b, { heading: "Salt Year", shortTitle: null, title: null });
  assert.equal(named("Untitled"), "Salt Year");
  assert.equal(named("untitled story 2"), "Salt Year");
  assert.equal(named("Untitled Country"), "Untitled Country");
});

test("a stated title does not turn the opening heading into a scene break", () => {
  // The heading is the heading whichever value gets printed as the title.
  // Treating it as a divider opened the manuscript with a scene break.
  const story = parseStory(
    "---\ntitle: The Salt Year\n---\n\n# The Salt Year\n\nProse.\n",
    "fn"
  );
  assert.equal(story.blocks[0]?.kind, "para");
  assert.equal(story.heading, "The Salt Year");
  assert.equal(story.title, "The Salt Year");
});

test("markup in the heading stays out of the file name", () => {
  assert.equal(exportedAs("Untitled story", "# *Salt Year*\n\nProse.\n"), "Salt Year");
  assert.equal(
    exportedAs("Untitled story", "---\ntitle: The **Salt** Year\n---\n\nProse.\n"),
    "The Salt Year"
  );
});

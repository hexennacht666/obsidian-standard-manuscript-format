import { strict as assert } from "assert";
import { test } from "node:test";
import { toStoryFileName, uniquePath } from "../src/naming";

test("an ordinary title is its own filename", () => {
  assert.deepEqual(toStoryFileName("The Salt Year"), {
    fileName: "The Salt Year",
    needsTitleOverride: false,
  });
});

test("a colon in the title forces a frontmatter override", () => {
  // Filenames can't hold a colon on macOS or Windows, and subtitles are common.
  const r = toStoryFileName("The Salt Year: A Fragment");
  assert.equal(r.fileName, "The Salt Year A Fragment");
  assert.equal(r.needsTitleOverride, true);
});

test("other illegal characters are replaced without collapsing words", () => {
  const r = toStoryFileName('What/Then? "Nothing"');
  assert.equal(r.fileName, "What Then Nothing");
  assert.equal(r.needsTitleOverride, true);
});

test("a title that is entirely illegal still yields a usable filename", () => {
  const r = toStoryFileName("///");
  assert.equal(r.fileName, "Untitled story");
  assert.equal(r.needsTitleOverride, true);
});

test("leading dots are stripped so the file isn't hidden", () => {
  assert.equal(toStoryFileName("...And Then").fileName, "And Then");
});

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

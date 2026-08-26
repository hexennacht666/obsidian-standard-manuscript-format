import { strict as assert } from "assert";
import { test } from "node:test";
import { formatWordCount } from "../src/manuscript";
import { parseStory } from "../src/markdown";

test("rounding on says about, because the number is not the count", () => {
  assert.equal(formatWordCount(3443, true), "about 3,400 words");
  assert.equal(formatWordCount(4160, true), "about 4,200 words");
});

test("rounding off states the exact count and drops about", () => {
  assert.equal(formatWordCount(3443, false), "3,443 words");
  assert.equal(formatWordCount(912, false), "912 words");
});

test("about is dropped when rounding lands on the count exactly", () => {
  assert.equal(formatWordCount(3400, true), "3,400 words");
  assert.equal(formatWordCount(1000, true), "1,000 words");
});

test("counts under a hundred are never rounded, so never approximate", () => {
  assert.equal(formatWordCount(42, true), "42 words");
  assert.equal(formatWordCount(42, false), "42 words");
});

test("thousands are separated for readability", () => {
  assert.equal(formatWordCount(12345, false), "12,345 words");
});

// The README states that the count covers the story and nothing else. Nothing
// guarded that until now: the exclusion falls out of counting only "para"
// blocks, so a change to how blocks are built could break it silently.
test("the count covers the story body and nothing else", () => {
  const story = [
    "---",
    "Title: Alpha Bravo Charlie Delta Echo Foxtrot",
    "Content warnings:",
    "  - golf hotel india juliet",
    "  - kilo lima mike november",
    "---",
    "",
    "# Oscar Papa Quebec Romeo",
    "",
    "One two three four five.",
    "",
    "***",
    "",
    "Six seven eight nine ten.",
  ].join("\n");

  // Ten words of story. The title adds six, the content warnings eight, the
  // heading four, and the scene break one more mark — none may be counted.
  assert.equal(parseStory(story, "Untitled story").wordCount, 10);
});

test("a story with no properties counts the same as one carrying them", () => {
  const bare = "One two three four five.\n\nSix seven eight nine ten.\n";
  const dressed = `---\nTitle: A Title Of Several Words\n---\n\n${bare}`;
  assert.equal(parseStory(bare, "Untitled story").wordCount, 10);
  assert.equal(parseStory(dressed, "Untitled story").wordCount, 10);
});

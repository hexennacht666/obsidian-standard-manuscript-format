import { strict as assert } from "assert";
import { test } from "node:test";
import { smartTypography } from "../src/typography";

test("curls double quotes by context", () => {
  assert.equal(smartTypography('"Hello," she said.'), "“Hello,” she said.");
});

test("re-derives quotes that were already curly the wrong way", () => {
  // Straight from a real manuscript that had been pasted between Obsidian and
  // Scrivener: mixed straight and curly, and the final quote curled the wrong
  // way. Only the whole paragraph carries enough state to fix it.
  assert.equal(
    smartTypography(
      '"Right about now you\'re feeling your heart slow down. ' +
        'It smells deceptively like bergamot, doesn’t it?“ Aello’s grabbing grew insistent.'
    ),
    "“Right about now you’re feeling your heart slow down. " +
      "It smells deceptively like bergamot, doesn’t it?” Aello’s grabbing grew insistent."
  );
});

test("an em dash before a quote resolves by state, not by the dash", () => {
  // Interrupted dialogue: the dash precedes a CLOSING quote.
  assert.equal(smartTypography('"Don\'t you dare--"'), "“Don’t you dare—”");
  // Dialogue starting mid-sentence: the same dash precedes an OPENING quote.
  assert.equal(
    smartTypography(`He turned--"Don't."`),
    "He turned—“Don’t.”"
  );
});

test("a forgotten closing quote does not invert the quotes after it", () => {
  // The close after "Hello," is missing. The second quote is unmistakably
  // opening, so it opens — leaving one dangling quote instead of flipping
  // every quote in the rest of the paragraph.
  assert.equal(
    smartTypography(`"Hello, she said. "How are you?"`),
    "“Hello, she said. “How are you?”"
  );
});

test("speech running past a paragraph re-opens rather than closing", () => {
  // Each paragraph is typographed on its own, which is what makes the
  // open-with-no-close convention come out right.
  assert.equal(
    smartTypography('"It went on for years.'),
    "“It went on for years."
  );
  assert.equal(
    smartTypography('"And it never stopped."'),
    "“And it never stopped.”"
  );
});

test("apostrophes inside and after words", () => {
  assert.equal(smartTypography("don't"), "don’t");
  assert.equal(smartTypography("the dogs' bowls"), "the dogs’ bowls");
});

test("leading-apostrophe elisions are not opening quotes", () => {
  assert.equal(smartTypography("get 'em"), "get ’em");
  assert.equal(smartTypography("'Tis the season"), "’Tis the season");
  assert.equal(smartTypography("back in the '90s"), "back in the ’90s");
});

test("real single quotes still open", () => {
  assert.equal(
    smartTypography(`"She said 'no' to me."`),
    "“She said ‘no’ to me.”"
  );
});

test("dashes and ellipses", () => {
  assert.equal(smartTypography("wait--no"), "wait—no");
  assert.equal(smartTypography("wait---no"), "wait—no");
  assert.equal(smartTypography("well..."), "well…");
  assert.equal(smartTypography("well . . ."), "well…");
});

test("existing em dashes and non-breaking spaces survive", () => {
  assert.equal(smartTypography("feed—I can't"), "feed—I can’t");
  assert.equal(smartTypography("a b"), "a b");
});

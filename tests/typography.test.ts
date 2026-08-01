import { strict as assert } from "assert";
import { test } from "node:test";
import { smartTypography } from "../src/typography";

test("curls double quotes by context", () => {
  assert.equal(smartTypography('"Hello," she said.'), "“Hello,” she said.");
});

test("re-derives quotes that were already curly the wrong way", () => {
  // A hand-typed opening quote where a closing one belongs.
  assert.equal(
    smartTypography('It smells like bergamot, doesn’t it?“ She grabbed at me.'),
    "It smells like bergamot, doesn’t it?” She grabbed at me."
  );
});

test("treats a quote after an em dash as closing, not opening", () => {
  // Interrupted dialogue is far more common in fiction than a dash-then-quote.
  assert.equal(smartTypography('"Don\'t you dare--"'), "“Don’t you dare—”");
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

import { strict as assert } from "assert";
import { test } from "node:test";
import { formatWordCount } from "../src/docx";

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

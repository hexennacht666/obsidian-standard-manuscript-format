import { strict as assert } from "assert";
import { test } from "node:test";
import { uniquePath } from "../src/naming";

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

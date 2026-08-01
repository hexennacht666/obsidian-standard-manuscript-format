/**
 * Renders a markdown story to .docx outside Obsidian so the output can be
 * inspected without a manual round-trip through the app.
 *
 *   npm run sample -- <input.md> <output.docx>
 */
import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";
import { buildManuscript, packDocument } from "../src/docx";
import { parseStory } from "../src/markdown";
import { DEFAULT_SETTINGS } from "../src/settings";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: npm run sample -- <input.md> <output.docx>");
  process.exit(1);
}

const settings = {
  ...DEFAULT_SETTINGS,
  legalName: "Beth Dean",
  penName: "Beth Dean",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
  phone: "555-0100",
};

const source = readFileSync(input, "utf8");
const story = parseStory(source, basename(input, ".md"));

console.log("title:      ", story.title);
console.log("short title:", story.shortTitle);
console.log("word count: ", story.wordCount);
console.log("blocks:     ", story.blocks.length, "(paragraphs + scene breaks)");
console.log(
  "scene breaks:",
  story.blocks.filter((b) => b.kind === "sceneBreak").length
);
console.log("unclosed:   ", story.unclosedQuotes.length);
for (const u of story.unclosedQuotes) console.log(`  ¶${u.paragraph} ${u.excerpt}`);

packDocument(buildManuscript(story, settings)).then((buf) => {
  writeFileSync(output, Buffer.from(buf));
  console.log("wrote:      ", output);
});

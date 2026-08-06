/**
 * Renders a markdown story outside Obsidian so the output can be inspected
 * without a manual round-trip through the app. The output extension picks the
 * emitter, which is how both renderings get compared against each other in the
 * same readers.
 *
 *   npm run sample -- <input.md> <output.docx|output.rtf> [--keep-bold]
 */
import { readFileSync, writeFileSync } from "fs";
import { basename, extname } from "path";
import { buildManuscript, packDocument } from "../src/docx";
import { parseStory } from "../src/markdown";
import { buildRtf } from "../src/rtf";
import { DEFAULT_SETTINGS } from "../src/settings";

const args = process.argv.slice(2);
const keepBold = args.includes("--keep-bold");
const [input, output] = args.filter((a) => !a.startsWith("--"));
if (!input || !output) {
  console.error(
    "usage: npm run sample -- <input.md> <output.docx|output.rtf> [--keep-bold]"
  );
  process.exit(1);
}

const settings = {
  ...DEFAULT_SETTINGS,
  stripBold: !keepBold,
  legalName: "Beth Dean",
  penName: "Beth Dean",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
  phone: "555-0100",
};

const source = readFileSync(input, "utf8");
const story = parseStory(source, basename(input, ".md"), {
  stripBold: settings.stripBold,
});

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

if (extname(output).toLowerCase() === ".rtf") {
  writeFileSync(output, buildRtf(story, settings), "utf8");
  console.log("wrote:      ", output);
} else {
  packDocument(buildManuscript(story, settings)).then((buf) => {
    writeFileSync(output, Buffer.from(buf));
    console.log("wrote:      ", output);
  });
}

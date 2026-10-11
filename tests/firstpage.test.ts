import { strict as assert } from "assert";
import { test } from "node:test";
import JSZip from "jszip";
import { buildManuscript, packDocument } from "../src/docx";
import { contactLines, singleLinePoints, titleGapLines } from "../src/manuscript";
import { parseStory } from "../src/markdown";
import { buildRtf } from "../src/rtf";
import { DEFAULT_SETTINGS, type BlindMode, type SmfSettings } from "../src/settings";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
};

const SOURCE = "# The Salt Year\n\nThe first line of the story.\n";

function story() {
  return parseStory(SOURCE, "fn");
}

async function docxParts(blind: BlindMode) {
  const zip = await JSZip.loadAsync(
    await packDocument(buildManuscript(story(), { ...settings, blindSubmission: blind }))
  );
  const read = async (name: string) => (await zip.file(name)?.async("string")) ?? "";
  const document = await read("word/document.xml");
  const rels = await read("word/_rels/document.xml.rels");
  // Which header part is the first page's and which is every other page's.
  const headerFor = async (type: "first" | "default") => {
    const ref = new RegExp(`<w:headerReference w:type="${type}" r:id="([^"]+)"`).exec(document);
    const target = ref && new RegExp(`Id="${ref[1]}"[^>]*Target="([^"]+)"`).exec(rels);
    return target ? read(`word/${target[1]}`) : "";
  };
  return {
    document,
    firstHeader: await headerFor("first"),
    defaultHeader: await headerFor("default"),
  };
}

const PAGE_BREAK = '<w:br w:type="page"/>';

for (const blind of ["off", "anonymous"] as const) {
  test(`the story starts on the first page, under the byline (.docx, blind ${blind})`, async () => {
    const { document, firstHeader, defaultHeader } = await docxParts(blind);
    assert.ok(!document.includes(PAGE_BREAK), "page break before the story");
    assert.ok(document.indexOf("The Salt Year") < document.indexOf("The first line of the story"));
    // Page 1 has a header part of its own, and it is empty; page 2 on carries
    // the running head.
    assert.match(document, /<w:titlePg\/>/);
    assert.doesNotMatch(firstHeader, /Salt Year/);
    assert.match(defaultHeader, /Salt Year \/ /);
  });

  test(`the story starts on the first page, under the byline (.rtf, blind ${blind})`, () => {
    const out = buildRtf(story(), { ...settings, blindSubmission: blind });
    assert.ok(!out.includes("\\sect\n"), "a section break pushes the story to page 2");
    assert.ok(!out.includes("\\sbkpage"));
    assert.ok(!/\\page[^a-z]/.test(out), "stray \\page");
    // One section, with a first-page header that is empty and a running head
    // for every page after it.
    assert.match(out, /\\sectd[^\n]*\\titlepg/);
    const first = /\{\\headerf([^{}]*)\}/.exec(out);
    assert.ok(first, "no first-page header");
    assert.doesNotMatch(first[1], /Salt/);
    assert.match(out, /\{\\header\\pard[^}]*Salt Year \/ \{\\field/);
    assert.ok(out.indexOf("The Salt Year") < out.indexOf("The first line of the story"));
  });
}

test("an identified cover page is still a page of its own (.docx)", async () => {
  const { document, firstHeader, defaultHeader } = await docxParts("coverPage");
  const brk = document.indexOf(PAGE_BREAK);
  assert.ok(brk !== -1, "no page break after the cover page");
  assert.ok(brk < document.indexOf("The first line of the story"));
  assert.doesNotMatch(firstHeader, /Salt Year/);
  assert.match(defaultHeader, /Salt Year \/ /);
});

test("an identified cover page is still a page of its own (.rtf)", () => {
  const out = buildRtf(story(), { ...settings, blindSubmission: "coverPage" });
  const sect = out.indexOf("\\sect\n");
  assert.ok(sect !== -1, "no second section");
  assert.ok(out.includes("\\sbkpage") && out.includes("\\pgncont"));
  assert.ok(!out.includes("\\titlepg"), "\\titlepg here would take page 2's running head");
  assert.ok(out.indexOf("{\\header") > sect, "running head declared on the cover page");
  assert.ok(sect < out.indexOf("The first line of the story"));
});

test("the title line starts four inches below the top margin, whatever the contact block", () => {
  const line = singleLinePoints(12);
  for (const band of [1, 2, 4, 7]) {
    const start = (band + titleGapLines(band, 12)) * line;
    assert.ok(Math.abs(start - 288) <= line, `${band} lines: title at ${start}pt`);
  }
  assert.notEqual(titleGapLines(2, 12), titleGapLines(7, 12));
  assert.ok(titleGapLines(2, 14) < titleGapLines(2, 12), "larger type takes fewer lines");
});

test("a very tall contact block still leaves a gap above the title", () => {
  assert.equal(titleGapLines(40, 12), 2);
});

test("the gap above the title is that many empty single-spaced lines in both formats", async () => {
  const band = contactLines(settings).length;
  const gap = titleGapLines(band, settings.fontSize);

  const { document } = await docxParts("off");
  const afterBanner = document.slice(document.indexOf("</w:tbl>"), document.indexOf("The Salt Year"));
  const empty = afterBanner.match(/<w:p>(?:(?!<\/w:p>).)*?<w:t xml:space="preserve"><\/w:t>/g) ?? [];
  assert.equal(empty.length, gap);
  // An empty line's height comes from its paragraph mark, so the mark states
  // the size too.
  assert.match(afterBanner, /<w:pPr>(?:(?!<\/w:pPr>).)*<w:rPr>(?:(?!<\/w:rPr>).)*<w:sz w:val="24"\/>/);

  const out = buildRtf(story(), settings);
  const lines = out.slice(out.indexOf("you@example.com"), out.indexOf("The Salt Year")).split("\n");
  assert.equal(lines.filter((l) => /\\sl240\\slmult1\\f0\\fs24 \\par$/.test(l)).length, gap);
});

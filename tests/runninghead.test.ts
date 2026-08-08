import { strict as assert } from "assert";
import { test } from "node:test";
import { runningHeadName, runningHeadPrefix, surnameOf } from "../src/manuscript";
import { parseStory } from "../src/markdown";
import { DEFAULT_SETTINGS, type SmfSettings } from "../src/settings";

const withName = (over: Partial<SmfSettings>): SmfSettings => ({
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  ...over,
});

test("a stated surname wins over the derived one", () => {
  assert.equal(runningHeadName(withName({ surname: "Le Guin" })), "Le Guin");
  assert.equal(
    runningHeadPrefix("SALT", withName({ surname: "Le Guin" })),
    "Le Guin / SALT / "
  );
});

test("blank still derives, which is right for most names", () => {
  assert.equal(runningHeadName(withName({ legalName: "Alex Chen" })), "Chen");
  // And wrong for this one, which is the whole reason the field exists.
  assert.equal(runningHeadName(withName({})), "Guin");
});

test("the stated surname is used whichever name is on the byline", () => {
  // One field answers for both, because the running head asks one question:
  // what goes on every page.
  const penned = withName({ penName: "Someone Else", surname: "Le Guin" });
  assert.equal(runningHeadName(penned), "Le Guin");
  assert.equal(runningHeadName({ ...penned, surname: "" }), "Else");
});

test("whitespace-only is treated as blank, not as a surname", () => {
  assert.equal(runningHeadName(withName({ surname: "   " })), "Guin");
});

test("a mononym can state itself", () => {
  const single = withName({ legalName: "Sappho", surname: "Sappho" });
  assert.equal(runningHeadName(single), "Sappho");
  // Deriving would have worked here anyway — the point is it isn't fought.
  assert.equal(runningHeadName({ ...single, surname: "" }), "Sappho");
});

test("blind still beats it — a stated surname is not a way back onto the page", () => {
  const stated = withName({ surname: "Le Guin" });
  assert.equal(
    runningHeadPrefix("SALT", { ...stated, blindSubmission: "anonymous" }),
    "SALT / "
  );
  assert.equal(
    runningHeadPrefix("SALT", { ...stated, blindSubmission: "coverPage" }),
    "SALT / "
  );
});

test("surnameOf keeps its old behaviour for callers that want a guess", () => {
  assert.equal(surnameOf("Ursula Le Guin"), "Guin");
  assert.equal(surnameOf(""), "AUTHOR");
});

// Shunn asks for "one or two keywords from the title" and says nothing about
// capitals. One word in capitals was ours, and it read worse: a manuscript is
// passed between readers who refer to it out loud.
test("the head takes two keywords, in the title's own case", () => {
  assert.equal(
    parseStory("Body.\n", "Only Perfumed Gloves Would Do").shortTitle,
    "Perfumed Gloves"
  );
  assert.equal(parseStory("Body.\n", "The Salt Year").shortTitle, "Salt Year");
});

// Length is not what makes a keyword recognisable — the old rule picked the
// longest word, which is how "Perfumed" beat "Gloves" by two letters.
test("keywords come in title order, not longest first", () => {
  assert.equal(
    parseStory("Body.\n", "The Cartographer's Wake").shortTitle,
    "Cartographer's Wake"
  );
});

test("two long keywords fall back to one", () => {
  // 28 characters together, so the second is dropped rather than printed.
  assert.equal(
    parseStory("Body.\n", "Extraordinary Circumstances").shortTitle,
    "Extraordinary"
  );
});

// Beth's worry: a long surname beside a two-word keyword. Even at the extreme
// the head is about half the width of a 6.5" line at 12pt.
test("a long surname and two keywords still make a short head", () => {
  const settings: SmfSettings = {
    ...DEFAULT_SETTINGS,
    legalName: "Aoife Ní Shúilleabháin",
    surname: "Ní Shúilleabháin",
  };
  const head = runningHeadPrefix("Perfumed Gloves", settings) + "12";
  assert.equal(head, "Ní Shúilleabháin / Perfumed Gloves / 12");
  assert.ok(head.length < 45);
});

test("a story can still overrule the derivation from its own frontmatter", () => {
  const s = parseStory(
    "---\nShort title: Gloves\n---\n\nBody.\n",
    "Only Perfumed Gloves Would Do"
  );
  assert.equal(s.shortTitle, "Gloves");
});

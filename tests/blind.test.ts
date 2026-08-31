import { strict as assert } from "assert";
import { test } from "node:test";
import { parseStory } from "../src/markdown";
import {
  bylineOf,
  contactLines,
  nameWithPronouns,
  runningHeadPrefix,
} from "../src/manuscript";
import { buildRtf } from "../src/rtf";
import { DEFAULT_SETTINGS, type SmfSettings } from "../src/settings";

const identified: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  address: "123 Example Street\nPortland, OR 97201",
  email: "you@example.com",
};

const anonymous: SmfSettings = { ...identified, blindSubmission: "anonymous" };
const coverPage: SmfSettings = { ...identified, blindSubmission: "coverPage" };

function render(settings: SmfSettings): string {
  const story = parseStory("# The Salt Year\n\nA paragraph.\n", "fn");
  return buildRtf(story, settings);
}

test("anonymous strips every identifying part of the page", () => {
  assert.deepEqual(contactLines(anonymous), []);
  assert.equal(bylineOf(anonymous), "");
  assert.equal(runningHeadPrefix("SALT", anonymous), "SALT / ");
});

test("an identified cover page keeps the block and loses the running head name", () => {
  // The whole point of this arrangement: the name is on page one and nowhere
  // after it. Stripping the contact block here would produce an entry missing
  // the cover page the contest requires.
  assert.ok(contactLines(coverPage).includes("Ursula Le Guin"));
  assert.equal(bylineOf(coverPage), "Ursula Le Guin");
  assert.equal(runningHeadPrefix("SALT", coverPage), "SALT / ");
});

test("off is unchanged — surname in the head, name on the page", () => {
  // Still the derived value while `surname` is blank. Stating it is what fixes
  // "Le Guin" — see the running-head tests.
  assert.equal(runningHeadPrefix("SALT", identified), "Guin / SALT / ");
  assert.equal(bylineOf(identified), "Ursula Le Guin");
  assert.ok(contactLines(identified).includes("Ursula Le Guin"));
});

test("a pen name is what gets stripped, when there is one", () => {
  const penned = { ...identified, penName: "Someone Else" };
  assert.equal(runningHeadPrefix("SALT", penned), "Else / SALT / ");
  assert.equal(
    runningHeadPrefix("SALT", { ...penned, blindSubmission: "anonymous" }),
    "SALT / "
  );
  assert.equal(bylineOf({ ...penned, blindSubmission: "anonymous" }), "");
});

test("the rendered anonymous manuscript contains no name at all", () => {
  const out = render(anonymous);
  assert.ok(!out.includes("Le Guin"));
  assert.ok(!out.includes("Ursula"));
  // The address and email go with it — they identify just as well as a name.
  assert.ok(!out.includes("Portland"));
  assert.ok(!out.includes("you@example.com"));
  // The story itself still arrives.
  assert.ok(out.includes("Salt Year"));
});

test("the rendered cover-page manuscript keeps the block but not the head", () => {
  const out = render(coverPage);
  assert.ok(out.includes("Le Guin"));
  assert.ok(out.includes("Portland"));
  // The running head is the easy thing to miss, and the one that repeats on
  // every page of the entry that gets disqualified. Asserted against the head
  // the code actually builds — "Le Guin / SALT" would pass without testing
  // anything, since that string is never produced in the first place.
  assert.ok(!out.includes("Guin / SALT"));
});

const withPronouns: SmfSettings = { ...identified, pronouns: "they/them" };

test("pronouns print in parentheses after the name in the contact block", () => {
  assert.equal(contactLines(withPronouns)[0], "Ursula Le Guin (they/them)");
});

test("unset pronouns leave the name exactly as it was", () => {
  assert.equal(contactLines(identified)[0], "Ursula Le Guin");
  assert.equal(nameWithPronouns("Ursula Le Guin", "  "), "Ursula Le Guin");
});

test("pronouns follow the name and go nowhere else", () => {
  // The byline is a different line with a different job, and the running head
  // is a surname and a keyword. Neither takes pronouns.
  const penned: SmfSettings = { ...withPronouns, penName: "U. K. Le Guin" };
  assert.equal(contactLines(penned)[0], "Ursula Le Guin (they/them)");
  assert.equal(bylineOf(penned), "U. K. Le Guin");
  assert.equal(runningHeadPrefix("SALT", penned), "Guin / SALT / ");
});

test("an anonymous manuscript carries no pronouns either", () => {
  assert.deepEqual(contactLines({ ...anonymous, pronouns: "they/them" }), []);
});

test("an identified cover page prints them once, on the cover", () => {
  assert.equal(
    contactLines({ ...coverPage, pronouns: "they/them" })[0],
    "Ursula Le Guin (they/them)"
  );
  assert.equal(runningHeadPrefix("SALT", coverPage), "SALT / ");
});

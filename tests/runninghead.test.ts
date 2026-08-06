import { strict as assert } from "assert";
import { test } from "node:test";
import { runningHeadName, runningHeadPrefix, surnameOf } from "../src/manuscript";
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

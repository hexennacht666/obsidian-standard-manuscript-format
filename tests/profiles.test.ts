import { strict as assert } from "assert";
import { test } from "node:test";
import {
  describeOverrides,
  isGlobal,
  newProfileId,
  OVERRIDABLE_KEYS,
  hasDuplicateName,
  newProfile,
  setOverride,
  uniqueName,
  resolveProfile,
  sanitizeProfiles,
  type SmfProfile,
} from "../src/profiles";
import { DEFAULT_SETTINGS, type SmfSettings } from "../src/settings";

const settings: SmfSettings = {
  ...DEFAULT_SETTINGS,
  legalName: "Ursula Le Guin",
  email: "you@example.com",
};

function profile(overrides: SmfProfile["overrides"], name = "Neon Hemlock"): SmfProfile {
  return { id: "profile-1", name, overrides };
}

test("a profile with one field is a valid profile", () => {
  const merged = resolveProfile(settings, profile({ stripBold: false }));
  assert.equal(merged.stripBold, false);
  // Everything else falls through, which is the whole reason overrides beat a
  // second home for the settings.
  assert.equal(merged.fontSize, settings.fontSize);
  assert.equal(merged.legalName, "Ursula Le Guin");
});

test("no profile means the settings, untouched", () => {
  assert.deepEqual(resolveProfile(settings, undefined), settings);
});

test("identity is never overridable", () => {
  for (const key of ["legalName", "penName", "surname", "address", "outputFolder"]) {
    assert.equal(
      OVERRIDABLE_KEYS.includes(key as never),
      false,
      `${key} must not be a profile field`
    );
  }
});

// Beth's rule, and the reason it's narrow: a writer who keeps no profiles must
// still be able to submit blind without setting one up first.
test("blind submission stays reachable globally", () => {
  assert.equal(isGlobal("blindSubmission"), true);
});

test("a profile says what it changes, phrased as an outcome", () => {
  const summary = describeOverrides(
    settings,
    profile({ stripBold: false, lineSpacing: "single", blindSubmission: "anonymous" })
  );
  assert.deepEqual(summary, ["single-spaced", "bold kept", "no name anywhere"]);
});

// The settings screen is what the writer pictures, so a "difference" has to be
// a difference from their settings — not from the plugin's defaults.
test("an override matching the writer's own setting is not a difference", () => {
  const summary = describeOverrides(settings, profile({ stripBold: settings.stripBold }));
  assert.deepEqual(summary, []);
});

test("font preset and custom font don't report the font twice", () => {
  const summary = describeOverrides(
    settings,
    profile({ fontPreset: "custom", customFont: "Georgia" })
  );
  assert.deepEqual(summary, ["Georgia"]);
});

// A copy would look identical today and diverge silently later: change your
// default font next month and a profile made now would keep exporting the old
// one while still claiming to match your settings.
test("a new profile overrides nothing and follows the settings", () => {
  const fresh = newProfile("Lightspeed", []);
  assert.deepEqual(fresh.overrides, {});
  assert.deepEqual(resolveProfile(settings, fresh), settings);
  assert.deepEqual(describeOverrides(settings, fresh), []);

  const later = { ...settings, fontPreset: "times" as const, lineSpacing: "single" as const };
  assert.equal(resolveProfile(later, fresh).fontPreset, "times");
  assert.equal(resolveProfile(later, fresh).lineSpacing, "single");
});

test("an unnamed profile still gets a name", () => {
  assert.equal(newProfile("   ", []).name, "Untitled profile");
});

test("an edit away from the settings is stored", () => {
  const p = newProfile("Neon Hemlock", []);
  setOverride(p, settings, "stripBold", false);
  assert.deepEqual(p.overrides, { stripBold: false });
  assert.deepEqual(describeOverrides(settings, p), ["bold kept"]);
});

// Setting a field back to what the settings say has to remove the override,
// not store an equal copy — otherwise the field silently stops following the
// settings, and nothing on screen distinguishes the two.
test("an edit back to the settings resumes following them", () => {
  const p = newProfile("Neon Hemlock", []);
  setOverride(p, settings, "stripBold", false);
  setOverride(p, settings, "stripBold", settings.stripBold);
  assert.deepEqual(p.overrides, {});

  const later = { ...settings, stripBold: false };
  assert.equal(resolveProfile(later, p).stripBold, false);
});

test("a second profile of the same name is numbered, not doubled", () => {
  const first = newProfile("Neon Hemlock", []);
  const second = newProfile("Neon Hemlock", [first]);
  const third = newProfile("neon hemlock", [first, second]);

  assert.equal(second.name, "Neon Hemlock 2");
  // Case-insensitively, because two rows differing only in case are two rows
  // nobody can tell apart in the picker either.
  assert.equal(third.name, "neon hemlock 3");
});

// Renaming happens on the profile's own page, where refusing a name mid-word
// would be worse than allowing it — so the collision is reported, not blocked.
test("a renamed collision is reportable", () => {
  const a = { id: "profile-1", name: "Neon Hemlock", overrides: {} };
  const b = { id: "profile-2", name: "neon hemlock ", overrides: {} };
  const c = { id: "profile-3", name: "Lightspeed", overrides: {} };

  assert.equal(hasDuplicateName(a, [a, b, c]), true);
  assert.equal(hasDuplicateName(c, [a, b, c]), false);
});

test("blank names never collide", () => {
  const a = { id: "profile-1", name: "  ", overrides: {} };
  const b = { id: "profile-2", name: "", overrides: {} };
  assert.equal(hasDuplicateName(a, [a, b]), false);
});

test("a name only gets a number when it needs one", () => {
  assert.equal(uniqueName("Lightspeed", []), "Lightspeed");
});

test("ids don't collide", () => {
  const existing = [profile({}, "a"), { ...profile({}, "b"), id: "profile-2" }];
  assert.equal(newProfileId(existing), "profile-3");
});

test("a data.json that isn't a list of profiles reads as no profiles", () => {
  // Every menu and command asks whether a profile exists, so this is a
  // load-time crash rather than an export-time one if it isn't guarded.
  assert.deepEqual(sanitizeProfiles(undefined), []);
  assert.deepEqual(sanitizeProfiles("Neon Hemlock"), []);
  assert.deepEqual(sanitizeProfiles([null, 3, { name: "no id" }, { id: "x" }]), []);
});

test("a profile from disk keeps only the keys this version knows", () => {
  const [read] = sanitizeProfiles([
    {
      id: "profile-1",
      name: "Neon Hemlock",
      overrides: { stripBold: false, unknownFutureField: "surprise" },
    },
  ]);
  assert.deepEqual(read.overrides, { stripBold: false });
  assert.equal(resolveProfile(settings, read).stripBold, false);
});

test("a profile with no overrides object still loads", () => {
  const [read] = sanitizeProfiles([{ id: "profile-1", name: "Empty" }]);
  assert.deepEqual(read.overrides, {});
  assert.deepEqual(resolveProfile(settings, read), settings);
});

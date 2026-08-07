import { strict as assert } from "assert";
import { test } from "node:test";
import {
  describeOverrides,
  isGlobal,
  newProfileId,
  OVERRIDABLE_KEYS,
  profileFromSettings,
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

test("saving the current settings carries every overridable field", () => {
  const saved = profileFromSettings(settings, "Lightspeed", []);
  assert.deepEqual(Object.keys(saved.overrides).sort(), [...OVERRIDABLE_KEYS].sort());
  // And changes nothing until it's edited.
  assert.deepEqual(resolveProfile(settings, saved), settings);
  assert.deepEqual(describeOverrides(settings, saved), []);
});

test("an unnamed profile still gets a name", () => {
  assert.equal(profileFromSettings(settings, "   ", []).name, "Untitled profile");
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

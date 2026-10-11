/**
 * Export profiles: named sets of overrides layered on the global settings.
 *
 * The failure this exists to prevent is asymmetric. Forgetting to turn a
 * per-market setting *on* costs one bad submission and you find out. Forgetting
 * to turn it back *off* silently applies to every submission after it, and the
 * settings screen looks exactly as you left it. A profile is used at the moment
 * of export and never becomes state.
 *
 * No Obsidian imports here on purpose — resolution and the human summaries are
 * the parts worth testing, and they test in plain Node.
 */
import { DEFAULT_SETTINGS, resolveFont, type SmfSettings } from "./settings";

export type OverridableKey =
  | "exportFormat"
  | "fontPreset"
  | "customFont"
  | "fontSize"
  | "lineSpacing"
  | "emphasis"
  | "stripBold"
  | "blindSubmission"
  | "includeContentWarnings"
  | "contentWarningPlacement"
  | "contentWarningLabel"
  | "includeAddress"
  | "includeEmail"
  | "includePhone";

/** The settings a profile can change. Identity and folders stay global. */
export const OVERRIDABLE_KEYS: OverridableKey[] = [
  "exportFormat",
  "fontPreset",
  "customFont",
  "fontSize",
  "lineSpacing",
  "emphasis",
  "stripBold",
  "blindSubmission",
  "includeContentWarnings",
  "contentWarningPlacement",
  "contentWarningLabel",
  "includeAddress",
  "includeEmail",
  "includePhone",
];

/**
 * Shown wherever a profile's summary would otherwise be empty — which is every
 * new profile, since one starts overriding nothing at all. Says the state
 * rather than the absence: "changes nothing" read like the profile was broken
 * rather than untouched.
 */
export const NO_CHANGES = "Same as your current settings";

export type ProfileOverrides = Partial<Pick<SmfSettings, OverridableKey>>;

export interface SmfProfile {
  id: string;
  name: string;
  /** Only what this profile changes. Everything else falls through. */
  overrides: ProfileOverrides;
}

/**
 * Ids rather than names as the handle, so renaming a profile doesn't orphan
 * anything and two profiles may briefly share a name while one is being typed.
 */
export function newProfileId(existing: SmfProfile[]): string {
  const taken = new Set(existing.map((p) => p.id));
  let n = 1;
  while (taken.has(`profile-${n}`)) n++;
  return `profile-${n}`;
}

/**
 * What survives a read of `data.json`. Nothing here trusts the file: a profile
 * missing its parts is dropped rather than repaired, because a half-read
 * profile would export a manuscript nobody chose.
 */
export function sanitizeProfiles(value: unknown): SmfProfile[] {
  if (!Array.isArray(value)) return [];
  const out: SmfProfile[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") continue;

    const raw =
      typeof record.overrides === "object" && record.overrides !== null
        ? (record.overrides as Record<string, unknown>)
        : {};

    // Only keys this version knows about, holding the type their setting
    // holds. A key from a later version would otherwise ride along into an
    // export that can't honor it, and a wrong-typed value would throw.
    const overrides: ProfileOverrides = {};
    for (const key of OVERRIDABLE_KEYS) {
      if (typeof raw[key] === typeof DEFAULT_SETTINGS[key]) {
        (overrides as Record<string, unknown>)[key] = raw[key];
      }
    }

    out.push({ id: record.id, name: record.name, overrides });
  }

  return out;
}

/**
 * The global settings with the profile's overrides on top. A key the profile
 * doesn't carry falls through, which is what keeps a one-field profile valid.
 */
export function resolveProfile(
  settings: SmfSettings,
  profile: SmfProfile | undefined
): SmfSettings {
  if (!profile) return settings;
  const merged = { ...settings };
  for (const key of OVERRIDABLE_KEYS) {
    const value = profile.overrides[key];
    if (value !== undefined) {
      // Each key's value type is its own; the loop erases that, and the
      // alternative is an assignment for every overridable field, and those drift.
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/**
 * How a resolved setting reads to a person, for the picker and for the notice
 * every export prints. Phrased as an outcome — "bold kept", not "strip bold:
 * off" — because it's read at the moment the file is written, when what matters
 * is what's in the file rather than which control produced it.
 */
function describe(key: OverridableKey, settings: SmfSettings): string {
  switch (key) {
    case "exportFormat":
      return settings.exportFormat === "docx"
        ? "Word (.docx)"
        : settings.exportFormat === "rtf"
          ? "rich text (.rtf)"
          : "both formats";
    case "fontPreset":
    case "customFont":
      return resolveFont(settings);
    case "fontSize":
      return `${settings.fontSize}pt`;
    case "lineSpacing":
      return settings.lineSpacing === "single" ? "single-spaced" : "double-spaced";
    case "emphasis":
      return settings.emphasis === "underline"
        ? "emphasis underlined"
        : settings.emphasis === "underscore"
          ? "emphasis in underscores"
          : "emphasis in italics";
    case "stripBold":
      return settings.stripBold ? "bold stripped" : "bold kept";
    case "blindSubmission":
      return settings.blindSubmission === "anonymous"
        ? "no name anywhere"
        : settings.blindSubmission === "coverPage"
          ? "named cover page, anonymous body"
          : "name on the manuscript";
    case "includeContentWarnings":
      return settings.includeContentWarnings
        ? "content warnings printed"
        : "no content warnings";
    case "contentWarningPlacement":
      return settings.contentWarningPlacement === "story"
        ? "warnings with the story"
        : settings.contentWarningPlacement === "both"
          ? "warnings on both pages"
          : "warnings on the title page";
    case "contentWarningLabel":
      return `labeled “${settings.contentWarningLabel.trim()}”`;
    case "includeAddress":
      return settings.includeAddress ? "address printed" : "no address";
    case "includeEmail":
      return settings.includeEmail ? "email printed" : "no email";
    case "includePhone":
      return settings.includePhone ? "phone printed" : "no phone";
  }
}

/**
 * What this profile actually changes, phrased for a person.
 *
 * Compared against the writer's own settings rather than the plugin's defaults:
 * the settings screen is what they'll picture, so that's what a difference has
 * to be a difference *from*.
 */
export function describeOverrides(
  settings: SmfSettings,
  profile: SmfProfile | undefined
): string[] {
  if (!profile) return [];
  const merged = resolveProfile(settings, profile);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const key of OVERRIDABLE_KEYS) {
    if (profile.overrides[key] === undefined) continue;
    if (merged[key] === settings[key]) continue;

    // Font preset and custom font are two keys with one visible outcome, and a
    // profile that sets both would otherwise say the font twice.
    const phrase = describe(key, merged);
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
  }

  return out;
}

/**
 * A new profile overrides nothing at all.
 *
 * It reads as "your current settings" because that is exactly what it is: every
 * field falls through until the writer changes one. Copying the settings in
 * would look identical on the day and diverge silently afterwards — change your
 * default font next month and every profile made before it would quietly keep
 * exporting the old one, while still claiming to match your settings.
 */
export function newProfile(name: string, existing: SmfProfile[]): SmfProfile {
  return {
    id: newProfileId(existing),
    name: uniqueName(name.trim() || "Untitled profile", existing),
    overrides: {},
  };
}

/**
 * "Neon Hemlock" a second time becomes "Neon Hemlock 2", the way Obsidian names
 * a duplicate file. Renaming quietly is a small rudeness; two identical rows in
 * the export picker, distinguishable only by their summaries, is a larger one.
 *
 * It can't cover renaming — that happens on the profile's own page, where
 * refusing a name mid-word would be worse than allowing it. A row whose name
 * collides carries a warning instead; see `hasDuplicateName`.
 */
export function uniqueName(name: string, existing: SmfProfile[]): string {
  const taken = new Set(existing.map((p) => p.name.trim().toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;

  let n = 2;
  while (taken.has(`${name} ${n}`.toLowerCase())) n++;
  return `${name} ${n}`;
}

/** Whether another profile answers to the same name. Blank names never collide. */
export function hasDuplicateName(
  profile: SmfProfile,
  profiles: SmfProfile[]
): boolean {
  const name = profile.name.trim().toLowerCase();
  if (!name) return false;
  return profiles.some(
    (other) => other.id !== profile.id && other.name.trim().toLowerCase() === name
  );
}

/**
 * Removes the profile with this one's id. Matched by id because the settings
 * can be reloaded from disk while the profile's page is open, leaving the page
 * holding a copy; a profile that is no longer listed removes nothing.
 */
export function removeProfile(profiles: SmfProfile[], profile: SmfProfile): void {
  const index = profiles.findIndex((p) => p.id === profile.id);
  if (index !== -1) profiles.splice(index, 1);
}

/**
 * Setting a profile's field back to what the settings say removes the override
 * rather than storing an equal copy, so the field resumes following the
 * settings. The two are indistinguishable today — `describeOverrides` already
 * treats an equal override as no difference — and they stop being
 * indistinguishable the moment the setting changes.
 */
export function setOverride<K extends OverridableKey>(
  profile: SmfProfile,
  settings: SmfSettings,
  key: K,
  value: SmfSettings[K]
): void {
  if (value === settings[key]) {
    delete profile.overrides[key];
  } else {
    (profile.overrides as Record<string, unknown>)[key] = value;
  }
}

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
 *
 * See docs/design-export-profiles.md for what was deliberately not built.
 */
import { resolveFont, type SmfSettings } from "./settings";

/**
 * Where a setting is allowed to live.
 *
 * `global` — on the Manuscript screen, and overridable by a profile.
 * `profileOnly` — reachable only inside a profile.
 *
 * This is a per-field decision, not a policy, which is why it sits beside the
 * field rather than in the code that reads it. The one field that must stay
 * `global` on principle is blind submission: most writers will never keep a
 * per-market profile, and a blind submission is decided by a single call from
 * a market, so putting it behind profile setup is friction on the majority to
 * tidy the screen for the minority. Everything else is a judgment about
 * crowding and can be changed here alone.
 */
export type Placement = "global" | "profileOnly";

export interface ProfileField {
  key: OverridableKey;
  placement: Placement;
}

export type OverridableKey =
  | "exportFormat"
  | "fontPreset"
  | "customFont"
  | "fontSize"
  | "lineSpacing"
  | "italicsAsUnderline"
  | "stripBold"
  | "blindSubmission"
  | "includeContentWarnings"
  | "contentWarningLabel"
  | "includeAddress"
  | "includeEmail"
  | "includePhone";

export const PROFILE_FIELDS: ProfileField[] = [
  { key: "exportFormat", placement: "global" },
  { key: "fontPreset", placement: "global" },
  { key: "customFont", placement: "global" },
  { key: "fontSize", placement: "global" },
  { key: "lineSpacing", placement: "global" },
  { key: "italicsAsUnderline", placement: "global" },
  { key: "stripBold", placement: "global" },
  { key: "blindSubmission", placement: "global" },
  { key: "includeContentWarnings", placement: "global" },
  { key: "contentWarningLabel", placement: "global" },
  { key: "includeAddress", placement: "global" },
  { key: "includeEmail", placement: "global" },
  { key: "includePhone", placement: "global" },
];

export const OVERRIDABLE_KEYS: OverridableKey[] = PROFILE_FIELDS.map((f) => f.key);

export function placementOf(key: OverridableKey): Placement {
  return PROFILE_FIELDS.find((f) => f.key === key)?.placement ?? "global";
}

/** Whether the Manuscript screen shows this field at all. */
export function isGlobal(key: OverridableKey): boolean {
  return placementOf(key) === "global";
}

/**
 * Shown wherever a profile's summary would otherwise be empty — which is every
 * freshly saved profile, since one starts as a copy of the settings. Says the
 * state rather than the absence: "changes nothing" read like the profile was
 * broken rather than untouched.
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

    // Only keys this version knows about. A key from a later version would
    // otherwise ride along into an export that can't honour it.
    const overrides: ProfileOverrides = {};
    for (const key of OVERRIDABLE_KEYS) {
      if (raw[key] !== undefined) {
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
      // alternative is thirteen hand-written assignments that drift.
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
    case "italicsAsUnderline":
      return settings.italicsAsUnderline ? "italics underlined" : "italics kept";
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
    case "contentWarningLabel":
      return `labelled “${settings.contentWarningLabel.trim()}”`;
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
 * A profile made from the settings as they stand, carrying every overridable
 * field. Starting from ~90% correct is what keeps setup cost near zero — the
 * defaults are already standard format, so a new profile is usually one edit
 * away from right.
 */
export function profileFromSettings(
  settings: SmfSettings,
  name: string,
  existing: SmfProfile[]
): SmfProfile {
  const overrides: ProfileOverrides = {};
  for (const key of OVERRIDABLE_KEYS) {
    (overrides as Record<string, unknown>)[key] = settings[key];
  }
  return { id: newProfileId(existing), name: name.trim() || "Untitled profile", overrides };
}

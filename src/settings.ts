import type { SmfProfile } from "./profiles";

export type FontPreset = "courier" | "times" | "custom";

/**
 * Times is the default because the standard this plugin implements says so.
 * Shunn's *modern* format — the one Clarkesworld, Uncanny and khōréō point at —
 * reads "choose something standard and easily readable, like Times New Roman";
 * Courier belongs to his *classic* version and is noted there as his own
 * preference.
 *
 * No market requires Courier, and two are actively easier in Times:
 * PseudoPod refuses Courier outright, and Beneath Ceaseless Skies asks for a
 * 12pt serif. Courier stays one click away for the classic look.
 *
 * Anything else is a market-specific ask — Neon Hemlock states an editorial
 * preference for Georgia, Lightspeed asks for Arial — so the two usual answers
 * are one click and everything else is still reachable.
 */
export const FONT_PRESETS: Record<Exclude<FontPreset, "custom">, string> = {
  courier: "Courier New",
  times: "Times New Roman",
};

export function resolveFont(settings: SmfSettings): string {
  if (settings.fontPreset === "custom") {
    return settings.customFont.trim() || FONT_PRESETS.times;
  }
  return FONT_PRESETS[settings.fontPreset] ?? FONT_PRESETS.times;
}

/**
 * Both formats are honest renderings of the same manuscript. RTF exists
 * because the markets disagree with each other, not because it's a fallback:
 * Clarkesworld refuses .doc, Beneath Ceaseless Skies refuses .docx, and both
 * accept RTF. "Both" is for anyone who'd rather
 * not check the guidelines twice.
 */
export type ExportFormat = "docx" | "rtf" | "both";

/**
 * Blind reading is not one arrangement, so this can't be a checkbox.
 *
 * Escape Pod and Clarion West want nothing identifying anywhere on the
 * manuscript. Writers of the Future wants the opposite pairing — a cover page
 * carrying legal name, pen name, address, phone and word count, then no name on
 * any page after it — and disqualifies entries that leave a name in the body.
 * A boolean set for one of those produces a disqualifying manuscript for the
 * other.
 */
export type BlindMode = "off" | "anonymous" | "coverPage";

/**
 * Double is Shunn's, and what markets either state or assume. Single exists
 * because Lightspeed prefers it *over* Shunn — Arial 14pt, single-spaced.
 *
 * Two values, not a free number: no market asks for anything between them.
 * One-and-a-half is a line in this table away if one does.
 */
export type LineSpacing = "double" | "single";

/** In twips, which is what both emitters' spacing controls take. */
export const LINE_SPACING_TWIPS: Record<LineSpacing, number> = {
  double: 480,
  single: 240,
};

/**
 * An emphasized run as it should read on the page.
 *
 * Only the underscore mode changes the text itself. Surrounding whitespace stays
 * outside the marks — `_ word _` is not what anyone means by emphasis, and a
 * run's edges routinely carry the space between it and the next word.
 */
export function emphasizedText(text: string, settings: SmfSettings): string {
  if (settings.emphasis !== "underscore") return text;

  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!match) return text;

  const [, before, core, after] = match;
  return core ? `${before}_${core}_${after}` : text;
}

/** The font size in half-points, which both formats take, rounded the same way. */
export function halfPoints(settings: SmfSettings): number {
  return Math.round(settings.fontSize * 2);
}

export function resolveLineSpacing(settings: SmfSettings): number {
  return LINE_SPACING_TWIPS[settings.lineSpacing] ?? LINE_SPACING_TWIPS.double;
}

/**
 * Where the story's content warnings are printed when the writer's details are
 * on an identified cover page. Otherwise the story starts under the byline and
 * they print there, once, whatever this says.
 *
 * The cover page is the default, where a slush reader meets them before the
 * story. Some markets want them with the story instead, set apart before the
 * first line. "Both" exists because a market that asks for one rarely forbids
 * the other.
 */
export type ContentWarningPlacement = "titlePage" | "story" | "both";

/**
 * How emphasis reaches the page.
 *
 * `italic` is what almost every market now wants. `underline` is the typewriter
 * convention a few still ask for. `underscore` is for Escape Pod, which wants
 * emphasis written as literal underscores, `_like this_`, in plain type: the
 * only mode that puts characters into the prose rather than formatting on it,
 * which is why it can't be faked with a style.
 */
export type Emphasis = "italic" | "underline" | "underscore";

/** Dropdown labels, shared by the settings screen and each profile's page. */
export const OPTION_LABELS = {
  exportFormat: {
    docx: "Word (.docx)",
    rtf: "Rich text (.rtf)",
    both: "Both",
  } satisfies Record<ExportFormat, string>,
  fontPreset: {
    courier: "Courier New",
    times: "Times New Roman",
    custom: "Custom…",
  } satisfies Record<FontPreset, string>,
  lineSpacing: {
    double: "Double",
    single: "Single",
  } satisfies Record<LineSpacing, string>,
  contentWarningPlacement: {
    titlePage: "Title page",
    story: "With the story",
    both: "Both",
  } satisfies Record<ContentWarningPlacement, string>,
  emphasis: {
    italic: "Italics",
    underline: "Underline",
    underscore: "Underscores, _like this_",
  } satisfies Record<Emphasis, string>,
  blindSubmission: {
    off: "Off — name on the manuscript",
    anonymous: "Anonymous throughout",
    coverPage: "Identified cover page only",
  } satisfies Record<BlindMode, string>,
};

export interface SmfSettings {
  /** Shunn puts the legal name in the contact block and allows a pen name on the byline. */
  legalName: string;
  penName: string;
  /**
   * What goes in the running head. Blank derives it from the name in use, which
   * is right for "Alex Chen" and wrong for every surname with a particle or a
   * second word — so it's asked rather than only inferred.
   */
  surname: string;
  pronouns: string;
  address: string;
  email: string;
  phone: string;
  membership: string;
  includeEmail: boolean;
  includePhone: boolean;
  includeAddress: boolean;
  blindSubmission: BlindMode;

  exportFormat: ExportFormat;
  fontPreset: FontPreset;
  /** Only consulted when fontPreset is "custom". */
  customFont: string;
  fontSize: number;
  /**
   * Applies to the story and the gaps on the title page. The contact block and
   * the running head stay single whatever this says — they are blocks of
   * address lines, not prose, and no market has ever wanted them opened out.
   */
  lineSpacing: LineSpacing;
  emphasis: Emphasis;
  /**
   * On, because Shunn's format has no bold. Off for the market that asks for
   * it kept — Neon Hemlock, the same one with the Georgia preference above.
   */
  stripBold: boolean;
  roundWordCount: boolean;
  /**
   * Shunn suggests centering the word END after the last line, because it
   * "can prevent ambiguity when your closing words fall near the bottom of the
   * page". Not `#`, which is what a scene break prints and means keep reading.
   * Blank prints nothing, which is also a perfectly ordinary manuscript.
   */
  endMarker: string;
  outputFolder: string;
  /** Blank means "alongside the note I'm in" rather than a fixed location. */
  newStoryFolder: string;
  warnUnclosedQuotes: boolean;
  /** The warnings themselves are per story; only presentation is global. */
  includeContentWarnings: boolean;
  contentWarningPlacement: ContentWarningPlacement;
  contentWarningLabel: string;
  /**
   * Named override sets, applied at the moment of export and never afterwards.
   * Type-only import so settings stays free of a runtime cycle. See
   * src/profiles.ts.
   */
  profiles: SmfProfile[];
}

export const DEFAULT_SETTINGS: SmfSettings = {
  legalName: "",
  penName: "",
  surname: "",
  pronouns: "",
  address: "",
  email: "",
  phone: "",
  membership: "",
  includeEmail: true,
  includePhone: false,
  includeAddress: true,
  blindSubmission: "off",

  exportFormat: "docx",
  fontPreset: "times",
  customFont: "",
  fontSize: 12,
  lineSpacing: "double",
  emphasis: "italic",
  stripBold: true,
  roundWordCount: true,
  endMarker: "END",
  outputFolder: "Manuscripts",
  newStoryFolder: "",
  warnUnclosedQuotes: true,
  includeContentWarnings: true,
  contentWarningPlacement: "titlePage",
  contentWarningLabel: "Content warnings",
  profiles: [],
};

/**
 * Settings as read from data.json. A hand edit or a sync conflict can leave
 * anything in the file, so a value whose type differs from its default's takes
 * the default instead of throwing somewhere far from here. Keys this version
 * doesn't know are kept, so a newer version's settings survive a save from an
 * older one. Profiles come back empty: `sanitizeProfiles` reads those.
 */
export function sanitizeSettings(data: unknown): SmfSettings {
  const record: Record<string, unknown> =
    typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  const settings = { ...DEFAULT_SETTINGS, ...record } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    if (typeof record[key] !== typeof fallback) settings[key] = fallback;
  }
  settings.profiles = [];
  return settings as unknown as SmfSettings;
}

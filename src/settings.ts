import type { SmfProfile } from "./profiles";

export type FontPreset = "courier" | "times" | "custom";

/**
 * Times is the default because the standard this plugin implements says so.
 * Shunn's *modern* format — the one Clarkesworld, Uncanny and khōréō point at —
 * reads "choose something standard and easily readable, like Times New Roman";
 * Courier belongs to his *classic* version and is noted there as his own
 * preference. Corrected 2026-08-07, having defaulted to Courier on the strength
 * of the opposite claim.
 *
 * No market surveyed requires Courier, and two are actively easier in Times:
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
 * Clarkesworld refuses .doc, Beneath Ceaseless Skies refuses .docx, and RTF is
 * the one format the whole survey accepts. "Both" is for anyone who'd rather
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
 * other. See docs/market-guidelines.md.
 */
export type BlindMode = "off" | "anonymous" | "coverPage";

/**
 * Double is Shunn's, and what every market surveyed either states or assumes.
 * Single exists because Lightspeed prefers it *over* Shunn — Arial 14pt,
 * single-spaced — so a plugin that can only double-space cannot produce a
 * manuscript for a market that publishes its preference outright. See
 * docs/market-guidelines.md.
 *
 * Two values, not a free number: no surveyed market asks for anything between
 * them. One-and-a-half is a line in this table away if one turns up.
 */
export type LineSpacing = "double" | "single";

/** In twips, which is what both emitters' spacing controls take. */
export const LINE_SPACING_TWIPS: Record<LineSpacing, number> = {
  double: 480,
  single: 240,
};

/**
 * An emphasised run as it should read on the page.
 *
 * Only the underscore mode changes the text itself. Surrounding whitespace stays
 * outside the marks — `_ word _` is not what anyone means by emphasis, and a
 * run's edges routinely carry the space between it and the next word.
 */
export function emphasisedText(text: string, settings: SmfSettings): string {
  if (settings.emphasis !== "underscore") return text;

  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  if (!match) return text;

  const [, before, core, after] = match;
  return core ? `${before}_${core}_${after}` : text;
}

export function resolveLineSpacing(settings: SmfSettings): number {
  return LINE_SPACING_TWIPS[settings.lineSpacing] ?? LINE_SPACING_TWIPS.double;
}

/**
 * Where the story's content warnings are printed.
 *
 * The title page is where a slush reader meets them before the story, which is
 * why it's the default. Some markets want them in the manuscript instead, set
 * apart before the first line, so a reader who opens to the story still meets
 * them first. "Both" exists because a market that asks for one rarely forbids
 * the other. See docs/market-guidelines.md.
 */
export type ContentWarningPlacement = "titlePage" | "story" | "both";

/**
 * How emphasis reaches the page.
 *
 * `italic` is what almost every market now wants. `underline` is the typewriter
 * convention a few still ask for — it stood alone as a boolean until Escape Pod
 * turned up wanting the third: emphasis written as literal underscores,
 * `_like this_`, in plain type. That one is the only mode that puts characters
 * into the prose rather than formatting on it, which is why it can't be faked
 * with a style. See docs/market-guidelines.md.
 */
export type Emphasis = "italic" | "underline" | "underscore";

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
   * Shunn suggests centring the word END after the last line, because it
   * "can prevent ambiguity when your closing words fall near the bottom of the
   * page". The default was `#` — the very symbol a scene break prints — so the
   * last mark in a story was indistinguishable from the mark that means keep
   * reading. Corrected 2026-08-07. Blank prints nothing, which is also a
   * perfectly ordinary manuscript.
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

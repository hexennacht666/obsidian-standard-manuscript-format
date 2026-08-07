export type FontPreset = "courier" | "times" | "custom";

/**
 * Shunn specifies a monospace face and Courier New is the default everywhere.
 * Times is the common alternative. Anything else is a market-specific ask —
 * Neon Hemlock, for one, states an editorial preference for Georgia — so the
 * two usual answers are one click and everything else is still reachable.
 */
export const FONT_PRESETS: Record<Exclude<FontPreset, "custom">, string> = {
  courier: "Courier New",
  times: "Times New Roman",
};

export function resolveFont(settings: SmfSettings): string {
  if (settings.fontPreset === "custom") {
    return settings.customFont.trim() || FONT_PRESETS.courier;
  }
  return FONT_PRESETS[settings.fontPreset] ?? FONT_PRESETS.courier;
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

export function resolveLineSpacing(settings: SmfSettings): number {
  return LINE_SPACING_TWIPS[settings.lineSpacing] ?? LINE_SPACING_TWIPS.double;
}

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
  italicsAsUnderline: boolean;
  /**
   * On, because Shunn's format has no bold. Off for the market that asks for
   * it kept — Neon Hemlock, the same one with the Georgia preference above.
   */
  stripBold: boolean;
  roundWordCount: boolean;
  endMarker: string;
  outputFolder: string;
  /** Blank means "alongside the note I'm in" rather than a fixed location. */
  newStoryFolder: string;
  warnUnclosedQuotes: boolean;
  /** The warnings themselves are per story; only presentation is global. */
  includeContentWarnings: boolean;
  contentWarningLabel: string;
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
  fontPreset: "courier",
  customFont: "",
  fontSize: 12,
  lineSpacing: "double",
  italicsAsUnderline: false,
  stripBold: true,
  roundWordCount: true,
  endMarker: "#",
  outputFolder: "Manuscripts",
  newStoryFolder: "",
  warnUnclosedQuotes: true,
  includeContentWarnings: true,
  contentWarningLabel: "Content warnings",
};

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

export interface SmfSettings {
  /** Shunn puts the legal name in the contact block and allows a pen name on the byline. */
  legalName: string;
  penName: string;
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

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

  fontPreset: FontPreset;
  /** Only consulted when fontPreset is "custom". */
  customFont: string;
  fontSize: number;
  italicsAsUnderline: boolean;
  roundWordCount: boolean;
  endMarker: string;
  outputFolder: string;
  /** Blank means "alongside the note I'm in" rather than a fixed location. */
  newStoryFolder: string;
  /** Adds a "Create new story" line to the empty-pane view. */
  showInEmptyPane: boolean;
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

  fontPreset: "courier",
  customFont: "",
  fontSize: 12,
  italicsAsUnderline: false,
  roundWordCount: true,
  endMarker: "#",
  outputFolder: "Manuscripts",
  newStoryFolder: "",
  showInEmptyPane: true,
  warnUnclosedQuotes: true,
  includeContentWarnings: true,
  contentWarningLabel: "Content warnings",
};

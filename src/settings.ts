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

  font: string;
  fontSize: number;
  italicsAsUnderline: boolean;
  roundWordCount: boolean;
  endMarker: string;
  outputFolder: string;
  warnUnclosedQuotes: boolean;
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

  font: "Courier New",
  fontSize: 12,
  italicsAsUnderline: false,
  roundWordCount: true,
  endMarker: "#",
  outputFolder: "Manuscripts",
  warnUnclosedQuotes: true,
};

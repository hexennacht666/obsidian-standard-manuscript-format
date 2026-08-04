import { App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type SmfExportPlugin from "./main";
import type { SmfSettings } from "./settings";

type Key = keyof SmfSettings;

export class SmfSettingTab extends PluginSettingTab {
  plugin: SmfExportPlugin;

  constructor(app: App, plugin: SmfExportPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Obsidian reads and writes every declarative control through this pair, so
   * the definitions below carry no per-control save wiring.
   */
  getControlValue(key: string): unknown {
    return this.plugin.settings[key as Key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings[key as Key] as unknown) = value;
    await this.plugin.saveSettings();
  }

  /** True once the byline has something to print. */
  private hasName(): boolean {
    return Boolean(
      this.plugin.settings.legalName.trim() || this.plugin.settings.penName.trim()
    );
  }

  getSettingDefinitions(): SettingDefinitionItem<Key>[] {
    return [
      {
        type: "page",
        name: "Author identity",
        desc: "Your contact block and byline. Set once; every manuscript uses it.",
        // Surfaces on the row, so the common case never needs opening.
        displayValue: () =>
          this.plugin.settings.penName.trim() ||
          this.plugin.settings.legalName.trim() ||
          "Not set",
        // The export refuses without a name. Say so here rather than at the
        // point of failure.
        status: () => (this.hasName() ? null : "warning"),
        items: [
          {
            name: "Legal name",
            desc: "Goes in the contact block, as Shunn specifies.",
            control: { type: "text", key: "legalName" },
          },
          {
            name: "Pen name",
            desc: "Used for the byline. Leave blank to use your legal name.",
            control: { type: "text", key: "penName" },
          },
          {
            name: "Pronouns",
            desc: "Optional. Used by cover letters.",
            control: { type: "text", key: "pronouns", placeholder: "she/her" },
          },
          {
            name: "Address",
            desc: "One line per line. Appears under your name in the contact block.",
            control: { type: "textarea", key: "address", rows: 3 },
          },
          {
            name: "Email",
            control: { type: "text", key: "email" },
          },
          {
            name: "Phone",
            control: { type: "text", key: "phone" },
          },
          {
            name: "Membership line",
            desc: "Optional, e.g. a professional membership. Shown at the end of the contact block.",
            control: { type: "text", key: "membership" },
          },
          {
            type: "group",
            heading: "Include per export",
            items: [
              {
                name: "Include address",
                desc: "Some markets don't want it.",
                control: { type: "toggle", key: "includeAddress" },
              },
              {
                name: "Include email",
                control: { type: "toggle", key: "includeEmail" },
              },
              {
                name: "Include phone",
                control: { type: "toggle", key: "includePhone" },
              },
            ],
          },
        ],
      },

      {
        type: "group",
        heading: "Manuscript",
        items: [
          {
            name: "Format",
            desc: "Markets disagree: some won't take .docx, some won't take .doc. Every market surveyed accepts RTF, so it's the safe answer when guidelines are vague.",
            control: {
              type: "dropdown",
              key: "exportFormat",
              options: {
                docx: "Word (.docx)",
                rtf: "Rich text (.rtf)",
                both: "Both",
              },
            },
          },
          {
            name: "Font",
            desc: "Shunn specifies Courier. Times is the usual alternative — use custom when a market asks for something specific.",
            control: {
              type: "dropdown",
              key: "fontPreset",
              options: {
                courier: "Courier New",
                times: "Times New Roman",
                custom: "Custom…",
              },
            },
          },
          {
            name: "Custom font",
            desc: "Exact font name, e.g. Georgia. Word substitutes if the reader doesn't have it.",
            // Replaces the old rebuild-the-whole-tab call.
            visible: () => this.plugin.settings.fontPreset === "custom",
            control: { type: "text", key: "customFont", placeholder: "Georgia" },
          },
          {
            name: "Font size",
            desc: "Points.",
            control: {
              type: "number",
              key: "fontSize",
              min: 1,
              // Said out loud rather than silently ignored, which is what the
              // old text field did with anything unusable.
              validate: (value) =>
                Number.isFinite(value) && value > 0
                  ? undefined
                  : "Enter a size greater than zero.",
            },
          },
          {
            name: "Underline instead of italics",
            desc: "Off means normal bold and italics, which is what almost every market now wants. Turn on only for one that still asks for the old typewriter convention.",
            control: { type: "toggle", key: "italicsAsUnderline" },
          },
          {
            name: "Round word count",
            desc: "Round to the nearest 100, the traditional convention.",
            control: { type: "toggle", key: "roundWordCount" },
          },
          {
            name: "End marker",
            desc: "Centred after the last line. Leave blank for none.",
            control: { type: "text", key: "endMarker" },
          },
          {
            name: "Include content warnings",
            desc: "Print them on the title page when the story's frontmatter has them. The warnings themselves are set per story, not here.",
            control: { type: "toggle", key: "includeContentWarnings" },
          },
          {
            name: "Content warning label",
            desc: "Wording some markets are particular about — 'Content notes' is the other common one.",
            visible: () => this.plugin.settings.includeContentWarnings,
            control: {
              type: "text",
              key: "contentWarningLabel",
              placeholder: "Content warnings",
            },
          },
          {
            name: "Mention unclosed quotes",
            desc: "After exporting, note any paragraph that opens dialogue and neither closes it nor carries it into the next paragraph. Never changes the manuscript.",
            control: { type: "toggle", key: "warnUnclosedQuotes" },
          },
        ],
      },

      {
        type: "group",
        heading: "Folders",
        items: [
          {
            name: "Output folder",
            desc: "Vault folder the .docx is written to. Created if missing.",
            control: {
              type: "folder",
              key: "outputFolder",
              placeholder: "Manuscripts",
              includeRoot: true,
            },
          },
          {
            name: "New story folder",
            desc: "Where “New story” puts the file. Leave blank to create it alongside the note you're in.",
            control: {
              type: "folder",
              key: "newStoryFolder",
              placeholder: "Leave blank for the current folder",
              includeRoot: true,
            },
          },
        ],
      },
    ];
  }
}

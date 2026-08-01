import { App, PluginSettingTab, Setting, TextAreaComponent } from "obsidian";
import type SmfExportPlugin from "./main";
import type { FontPreset, SmfSettings } from "./settings";

export class SmfSettingTab extends PluginSettingTab {
  plugin: SmfExportPlugin;

  constructor(app: App, plugin: SmfExportPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private text(
    name: string,
    desc: string,
    key: keyof SmfSettings,
    placeholder = ""
  ) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addText((t) =>
        t
          .setPlaceholder(placeholder)
          .setValue(String(this.plugin.settings[key] ?? ""))
          .onChange(async (value) => {
            (this.plugin.settings[key] as unknown) = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private toggle(name: string, desc: string, key: keyof SmfSettings) {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((t) =>
        t
          .setValue(Boolean(this.plugin.settings[key]))
          .onChange(async (value) => {
            (this.plugin.settings[key] as unknown) = value;
            await this.plugin.saveSettings();
          })
      );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Author").setHeading();

    this.text(
      "Legal name",
      "Goes in the contact block, as Shunn specifies.",
      "legalName"
    );
    this.text(
      "Pen name",
      "Used for the byline. Leave blank to use your legal name.",
      "penName"
    );
    this.text("Pronouns", "Optional. Used by cover letters.", "pronouns", "she/her");

    new Setting(containerEl)
      .setName("Address")
      .setDesc("One line per line. Appears under your name in the contact block.")
      .addTextArea((t: TextAreaComponent) => {
        t.setValue(this.plugin.settings.address).onChange(async (value) => {
          this.plugin.settings.address = value;
          await this.plugin.saveSettings();
        });
        t.inputEl.rows = 3;
      });

    this.text("Email", "", "email");
    this.text("Phone", "", "phone");
    this.text(
      "Membership line",
      "Optional, e.g. a professional membership. Shown at the end of the contact block.",
      "membership"
    );

    new Setting(containerEl).setName("Include per export").setHeading();
    this.toggle("Include address", "Some markets don't want it.", "includeAddress");
    this.toggle("Include email", "", "includeEmail");
    this.toggle("Include phone", "", "includePhone");

    new Setting(containerEl).setName("Manuscript").setHeading();

    new Setting(containerEl)
      .setName("Font")
      .setDesc(
        "Shunn specifies Courier. Times is the usual alternative — use Custom when a market asks for something specific."
      )
      .addDropdown((d) =>
        d
          .addOptions({
            courier: "Courier New",
            times: "Times New Roman",
            custom: "Custom…",
          })
          .setValue(this.plugin.settings.fontPreset)
          .onChange(async (value) => {
            this.plugin.settings.fontPreset = value as FontPreset;
            await this.plugin.saveSettings();
            this.display(); // show or hide the custom field
          })
      );

    if (this.plugin.settings.fontPreset === "custom") {
      this.text(
        "Custom font",
        "Exact font name, e.g. Georgia. Word substitutes if the reader doesn't have it.",
        "customFont",
        "Georgia"
      );
    }

    new Setting(containerEl)
      .setName("Font size")
      .setDesc("Points.")
      .addText((t) =>
        t.setValue(String(this.plugin.settings.fontSize)).onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) {
            this.plugin.settings.fontSize = n;
            await this.plugin.saveSettings();
          }
        })
      );

    this.toggle(
      "Underline instead of italics",
      "Off means normal bold and italics, which is what almost every market now wants. Turn on only for one that still asks for the old typewriter convention.",
      "italicsAsUnderline"
    );
    this.toggle(
      "Round word count",
      "Round to the nearest 100, the traditional convention.",
      "roundWordCount"
    );
    this.text(
      "End marker",
      "Centred after the last line. Leave blank for none.",
      "endMarker"
    );
    this.text(
      "Output folder",
      "Vault folder the .docx is written to. Created if missing.",
      "outputFolder"
    );
    this.toggle(
      "Include content warnings",
      "Print them on the title page when the story's frontmatter has them. The warnings themselves are set per story, not here.",
      "includeContentWarnings"
    );
    this.text(
      "Content warning label",
      "Wording some markets are particular about — 'Content notes' is the other common one.",
      "contentWarningLabel",
      "Content warnings"
    );
    this.toggle(
      "Mention unclosed quotes",
      "After exporting, note any paragraph that opens dialogue and neither closes it nor carries it into the next paragraph. Never changes the manuscript.",
      "warnUnclosedQuotes"
    );
  }
}

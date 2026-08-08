import { App, Setting, SettingPage } from "obsidian";
import { ConfirmModal } from "./confirmModal";
import type SmfExportPlugin from "./main";
import { setOverride, type OverridableKey, type SmfProfile } from "./profiles";
import type {
  BlindMode,
  ContentWarningPlacement,
  ExportFormat,
  FontPreset,
  LineSpacing,
  SmfSettings,
} from "./settings";

/**
 * One profile's overrides, rendered imperatively.
 *
 * It was declarative first, and that was wrong for a page whose own title and
 * list row depend on what's being typed into it. Refreshing them means
 * `update()`, which re-reads the definitions the open page was built from and
 * leaves it standing as an empty shell; not refreshing them leaves a page
 * titled with the profile's old name and a row that never catches up. A
 * `SettingPage` has the lifecycle the declarative form lacks: it is handed to
 * Obsidian by a factory, and `hide()` runs when the writer navigates away — so
 * the list is rebuilt exactly once, when leaving, and nothing is rebuilt
 * underneath the cursor.
 *
 * The cost is that these controls aren't in Obsidian's settings search. Only
 * the profile's row is, which is the right granularity anyway: searching for
 * "line spacing" should land on the setting, not on every profile that carries
 * one.
 */
export class ProfilePage extends SettingPage {
  /** Set once the profile is gone, since the page outlives it. */
  private deleted = false;

  constructor(
    private readonly app: App,
    private readonly plugin: SmfExportPlugin,
    private readonly profile: SmfProfile,
    private readonly onLeave: () => void,
    private readonly onDelete: () => void
  ) {
    super();
    this.title = titleOf(profile);
  }

  /** The profile's value for a field, or the setting it falls through to. */
  private valueOf<K extends OverridableKey>(key: K): SmfSettings[K] {
    return this.profile.overrides[key] ?? this.plugin.settings[key];
  }

  private save<K extends OverridableKey>(key: K, value: SmfSettings[K]): void {
    setOverride(this.profile, this.plugin.settings, key, value);
    void this.plugin.saveSettings();
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // Deleting from in here leaves the writer standing on the page of a
    // profile that no longer exists, because the settings API has no way to
    // navigate back from code. Saying so plainly beats a page of controls
    // that now edit nothing.
    if (this.deleted) {
      new Setting(containerEl)
        .setName("Deleted")
        .setDesc(
          `${this.title} is gone. Use the back arrow to return to your profiles.`
        );
      return;
    }

    // Without this the page reads as thirteen values the profile owns, when
    // in fact it owns only what gets changed here.
    new Setting(containerEl).setDesc(
      "Anything you don't change here follows your settings."
    );

    new Setting(containerEl)
      .setName("Name")
      .setDesc("Yours to choose. Most people name a profile after the market it's for.")
      .addText((text) =>
        text
          .setPlaceholder("Market or editor")
          .setValue(this.profile.name)
          .onChange((value) => {
            this.profile.name = value;
            // The titlebar is read from here; the row behind it is rebuilt on
            // the way out rather than on every keystroke.
            this.title = titleOf(this.profile);
            void this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Format")
      .setDesc("Most markets accept either .docx or .rtf.")
      .addDropdown((dropdown) =>
      dropdown
        .addOptions({
          docx: "Word (.docx)",
          rtf: "Rich text (.rtf)",
          both: "Both",
        })
        .setValue(this.valueOf("exportFormat"))
        .onChange((value) => this.save("exportFormat", value as ExportFormat))
    );

    new Setting(containerEl)
      .setName("Font")
      .setDesc("Times is what the modern standard recommends. Courier is the classic look.")
      .addDropdown((dropdown) =>
      dropdown
        .addOptions({
          courier: "Courier New",
          times: "Times New Roman",
          custom: "Custom…",
        })
        .setValue(this.valueOf("fontPreset"))
        .onChange((value) => {
          this.save("fontPreset", value as FontPreset);
          // Redrawing my own page is safe — it's the containing tab that must
          // not be rebuilt while this page is open.
          this.display();
        })
    );

    if (this.valueOf("fontPreset") === "custom") {
      new Setting(containerEl)
        .setName("Custom font")
        .setDesc("Exact font name. Word substitutes if the reader doesn't have it.")
        .addText((text) =>
          text
            .setPlaceholder("Georgia")
            .setValue(this.valueOf("customFont"))
            .onChange((value) => this.save("customFont", value))
        );
    }

    new Setting(containerEl)
      .setName("Font size")
      .setDesc("Points.")
      .addText((text) =>
        text.setValue(String(this.valueOf("fontSize"))).onChange((value) => {
          const size = Number(value);
          // Unusable input is left unsaved rather than written and silently
          // corrected at export, where nobody would see it happen.
          if (Number.isFinite(size) && size > 0) this.save("fontSize", size);
        })
      );

    new Setting(containerEl)
      .setName("Line spacing")
      .setDesc("Double is standard format. Single is for a market that asks for it outright.")
      .addDropdown((dropdown) =>
      dropdown
        .addOptions({ double: "Double", single: "Single" })
        .setValue(this.valueOf("lineSpacing"))
        .onChange((value) => this.save("lineSpacing", value as LineSpacing))
    );

    new Setting(containerEl)
      .setName("Underline instead of italics")
      .setDesc("On only for a market that still asks for the typewriter convention.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.valueOf("italicsAsUnderline"))
          .onChange((value) => this.save("italicsAsUnderline", value))
      );

    new Setting(containerEl)
      .setName("Strip bold")
      .setDesc("Standard format has no bold. Off keeps it, for an editor who asks.")
      .addToggle((toggle) =>
      toggle
        .setValue(this.valueOf("stripBold"))
        .onChange((value) => this.save("stripBold", value))
    );

    new Setting(containerEl)
      .setName("Blind submission")
      .setDesc(
        "Set by the market, and sometimes by a single call from one — which is what a profile is for."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            off: "Off — name on the manuscript",
            anonymous: "Anonymous throughout",
            coverPage: "Identified cover page only",
          })
          .setValue(this.valueOf("blindSubmission"))
          .onChange((value) => this.save("blindSubmission", value as BlindMode))
      );

    new Setting(containerEl)
      .setName("Include content warnings")
      .setDesc("Printed on the title page when the story's frontmatter has them.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.valueOf("includeContentWarnings"))
          .onChange((value) => {
            this.save("includeContentWarnings", value);
            this.display();
          })
      );

    if (this.valueOf("includeContentWarnings")) {
      new Setting(containerEl)
        .setName("Content warning placement")
        .setDesc("Some markets want them in the manuscript, before the first line.")
        .addDropdown((dropdown) =>
          dropdown
            .addOptions({
              titlePage: "Title page",
              story: "With the story",
              both: "Both",
            })
            .setValue(this.valueOf("contentWarningPlacement"))
            .onChange((value) =>
              this.save("contentWarningPlacement", value as ContentWarningPlacement)
            )
        );

      new Setting(containerEl)
        .setName("Content warning label")
        .setDesc("Wording some markets are particular about.")
        .addText((text) =>
          text
            .setPlaceholder("Content warnings")
            .setValue(this.valueOf("contentWarningLabel"))
            .onChange((value) => this.save("contentWarningLabel", value))
        );
    }

    new Setting(containerEl).setName("Contact block").setHeading();

    new Setting(containerEl)
      .setName("Include address")
      .setDesc("Some markets don't want it.")
      .addToggle((toggle) =>
      toggle
        .setValue(this.valueOf("includeAddress"))
        .onChange((value) => this.save("includeAddress", value))
    );

    new Setting(containerEl).setName("Include email").addToggle((toggle) =>
      toggle
        .setValue(this.valueOf("includeEmail"))
        .onChange((value) => this.save("includeEmail", value))
    );

    new Setting(containerEl).setName("Include phone").addToggle((toggle) =>
      toggle
        .setValue(this.valueOf("includePhone"))
        .onChange((value) => this.save("includePhone", value))
    );

    new Setting(containerEl)
      .setName("Delete this profile")
      .setDesc("Your settings and any other profiles are untouched.")
      .addButton((button) =>
        button
          .setButtonText("Delete profile")
          .setDestructive()
          .onClick(() => {
            new ConfirmModal(this.app, {
              title: `Delete ${titleOf(this.profile)}?`,
              message:
                "The profile and everything it changes will be removed. Your settings and any other profiles stay as they are.",
              confirmText: "Delete profile",
              onConfirm: () => {
                this.deleted = true;
                this.onDelete();
                this.display();
              },
            }).open();
          })
      );
  }

  hide() {
    super.hide();
    if (this.deleted) return;
    // Leaving is the moment the list can safely be rebuilt: the name and the
    // summary on the row are both stale by now, and no page is open to lose.
    this.onLeave();
  }
}

function titleOf(profile: SmfProfile): string {
  return profile.name.trim() || "Untitled profile";
}

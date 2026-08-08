import {
  App,
  PluginSettingTab,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
} from "obsidian";
import type SmfExportPlugin from "./main";
import { runningHeadName, surnameOf } from "./manuscript";
import { ProfileNameModal } from "./profileNameModal";
import { ProfilePage } from "./profilePage";
import {
  describeOverrides,
  isGlobal,
  NO_CHANGES,
  hasDuplicateName,
  newProfile,
  type SmfProfile,
} from "./profiles";
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
   * the definitions below carry no per-control save wiring. A profile's own
   * fields don't come through here — its page renders itself, for the reason
   * in src/profilePage.ts.
   */
  getControlValue(key: string): unknown {
    return this.plugin.settings[key as Key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    (this.plugin.settings[key as Key] as unknown) = value;
    await this.plugin.saveSettings();
  }

  private addProfile(): void {
    new ProfileNameModal(this.app, (name) => {
      const profiles = this.plugin.settings.profiles;
      profiles.push(newProfile(name, profiles));
      void this.plugin.saveSettings();
      this.update();
    }).open();
  }

  /** Only affects the order they're listed and offered in — nothing else reads it. */
  private moveProfile(from: number, to: number): void {
    const profiles = this.plugin.settings.profiles;
    const [moved] = profiles.splice(from, 1);
    if (!moved) return;
    profiles.splice(to, 0, moved);
    void this.plugin.saveSettings();
    this.update();
  }

  private deleteProfile(index: number): void {
    this.plugin.settings.profiles.splice(index, 1);
    void this.plugin.saveSettings();
    this.update();
  }

  /**
   * The row in the list, and a factory for the page behind it. The page is
   * imperative so that leaving it can refresh this row — see src/profilePage.ts.
   */
  private profileRow(profile: SmfProfile): SettingDefinitionPage<Key> {
    // Renaming happens on the page, where refusing a name mid-word would be
    // worse than allowing it — so a collision is reported here instead.
    const duplicate = hasDuplicateName(profile, this.plugin.settings.profiles);

    return {
      type: "page",
      name: profile.name.trim() || "Untitled profile",
      desc: duplicate
        ? "Another profile has this name. Both will look the same at export time."
        : undefined,
      status: () => (duplicate ? "warning" : null),
      displayValue: () => {
        const changes = describeOverrides(this.plugin.settings, profile);
        return changes.length ? changes.join(", ") : NO_CHANGES;
      },
      page: () =>
        new ProfilePage(
          this.app,
          this.plugin,
          profile,
          () => this.update(),
          () => this.deleteProfile(this.plugin.settings.profiles.indexOf(profile))
        ),
    };
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
        // Surfaces on the row, so the common case never needs opening. Blind is
        // named here too: a manuscript that silently carries your name and one
        // that silently doesn't are both bad, and neither is visible from the
        // top level otherwise.
        displayValue: () => {
          const name =
            this.plugin.settings.penName.trim() ||
            this.plugin.settings.legalName.trim() ||
            "Not set";
          switch (this.plugin.settings.blindSubmission) {
            case "anonymous":
              return "Blind — no name on the manuscript";
            case "coverPage":
              return `${name} — cover page only`;
            default:
              return name;
          }
        },
        // The export refuses without a name. Say so here rather than at the
        // point of failure — but an anonymous manuscript never prints one, so
        // there is nothing missing to warn about.
        status: () =>
          this.hasName() || this.plugin.settings.blindSubmission === "anonymous"
            ? null
            : "warning",
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
            name: "Surname",
            // The derived value goes in the placeholder and the resulting head
            // in the description, so a wrong guess is visible here — the one
            // page every user has to visit, since export refuses without a name.
            desc: createFragment((f) => {
              f.appendText(
                "Printed with the title and page number on every page after the first. Leave blank to use the last word of your name, which is wrong for a surname of more than one word."
              );
              f.createEl("br");
              f.appendText("Every page after the first will read ");
              f.createEl("code", {
                text: `${runningHeadName(this.plugin.settings)} / Short title / 2`,
              });
            }),
            visible: () => this.plugin.settings.blindSubmission === "off",
            control: {
              type: "text",
              key: "surname",
              placeholder: surnameOf(
                this.plugin.settings.penName || this.plugin.settings.legalName || ""
              ),
            },
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
            name: "Blind submission",
            // A list rather than a sentence: three modes a reader has to choose
            // between, and the dropdown's own labels are too short to carry the
            // distinction. Fragments are still indexed by settings search.
            desc: createFragment((f) => {
              f.appendText("Markets that read anonymously disagree about what to remove.");
              const modes = f.createEl("ul");
              modes.createEl("li", {
                text: "Anonymous throughout — no contact block, no byline, and no name in the running head.",
              });
              modes.createEl("li", {
                text: "Identified cover page — title page as usual, then no name on any page after it. Some contests disqualify entries that get this wrong.",
              });
              f.appendText(
                "Neither can rename the file, so keep your name out of the note's title."
              );
            }),
            // Deliberately not gated on isGlobal: a profile may override this,
            // but it can never be the only place to reach it. Most writers keep
            // no profiles, and blind submission has to work without setting one
            // up first.
            control: {
              type: "dropdown",
              key: "blindSubmission",
              options: {
                off: "Off — name on the manuscript",
                anonymous: "Anonymous throughout",
                coverPage: "Identified cover page only",
              },
            },
          },
          {
            type: "group",
            heading: "Include per export",
            // Nothing from this block is printed on an anonymous manuscript, so
            // it would be three controls sitting there doing nothing.
            visible: () =>
              this.plugin.settings.blindSubmission !== "anonymous" &&
              (isGlobal("includeAddress") ||
                isGlobal("includeEmail") ||
                isGlobal("includePhone")),
            items: [
              {
                name: "Include address",
                desc: "Some markets don't want it.",
                visible: () => isGlobal("includeAddress"),
                control: { type: "toggle", key: "includeAddress" },
              },
              {
                name: "Include email",
                visible: () => isGlobal("includeEmail"),
                control: { type: "toggle", key: "includeEmail" },
              },
              {
                name: "Include phone",
                visible: () => isGlobal("includePhone"),
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
            desc: "Most markets accept either .docx or .rtf. Check the guidelines if they ask for one.",
            visible: () => isGlobal("exportFormat"),
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
            desc: "Times is what the modern standard recommends. Courier is the classic look, still preferred by some editors. Use custom when a market asks for something else.",
            visible: () => isGlobal("fontPreset"),
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
            visible: () =>
              isGlobal("customFont") && this.plugin.settings.fontPreset === "custom",
            control: { type: "text", key: "customFont", placeholder: "Georgia" },
          },
          {
            name: "Font size",
            desc: "Points.",
            visible: () => isGlobal("fontSize"),
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
            name: "Line spacing",
            desc: "Double is standard format and the safe answer. Single is for the occasional market that asks for it outright, in preference to the standard.",
            visible: () => isGlobal("lineSpacing"),
            control: {
              type: "dropdown",
              key: "lineSpacing",
              options: {
                double: "Double",
                single: "Single",
              },
            },
          },
          {
            name: "Round word count",
            desc: "Round to the nearest 100, the traditional convention.",
            control: { type: "toggle", key: "roundWordCount" },
          },
          {
            name: "End marker",
            desc: "Centred after the last line, so an ending near the foot of a page can't be mistaken for a scene break. Leave blank for none.",
            control: { type: "text", key: "endMarker" },
          },
        ],
      },

      // Their own group rather than three rows inside Manuscript: whether,
      // where and what they're called read as one decision, and since they can
      // print with the story they aren't title-page furniture either.
      {
        type: "group",
        heading: "Content warnings",
        items: [
          {
            name: "Include content warnings",
            desc: "Print them when the story's frontmatter has them. The warnings themselves are set per story, not here.",
            visible: () => isGlobal("includeContentWarnings"),
            control: { type: "toggle", key: "includeContentWarnings" },
          },
          {
            name: "Content warning placement",
            desc: "The title page is where a first reader meets them before the story. Some markets want them in the manuscript instead, set apart before the first line.",
            visible: () =>
              isGlobal("contentWarningPlacement") &&
              this.plugin.settings.includeContentWarnings,
            control: {
              type: "dropdown",
              key: "contentWarningPlacement",
              options: {
                titlePage: "Title page",
                story: "With the story",
                both: "Both",
              },
            },
          },
          {
            name: "Content warning label",
            desc: "Wording some markets are particular about — 'Content notes' is the other common one.",
            visible: () =>
              isGlobal("contentWarningLabel") &&
              this.plugin.settings.includeContentWarnings,
            control: {
              type: "text",
              key: "contentWarningLabel",
              placeholder: "Content warnings",
            },
          },
        ],
      },

      // What the exporter does to what you actually wrote — including the
      // unclosed-quote check, which is not a property of the manuscript at all.
      {
        type: "group",
        heading: "Your prose",
        items: [
          {
            name: "Emphasis",
            desc: "Italics are what almost every market now wants. Underline is the typewriter convention a few still ask for. Underscores put the marks in the text itself, for a market that asks to see them.",
            visible: () => isGlobal("emphasis"),
            control: {
              type: "dropdown",
              key: "emphasis",
              options: {
                italic: "Italics",
                underline: "Underline",
                underscore: "Underscores, _like this_",
              },
            },
          },
          {
            name: "Strip bold",
            desc: "Shunn's format has no bold, so on means the words survive and the emphasis doesn't. Turn off for a market whose editor asks for bold kept.",
            visible: () => isGlobal("stripBold"),
            control: { type: "toggle", key: "stripBold" },
          },
          {
            name: "Mention unclosed quotes",
            desc: "After exporting, note any paragraph that opens dialogue and neither closes it nor carries it into the next paragraph. Never changes the manuscript.",
            control: { type: "toggle", key: "warnUnclosedQuotes" },
          },
        ],
      },

      {
        type: "list",
        heading: "Export profiles",
        desc: "Save an editor's or market's preferences as a profile, instead of changing your settings before a submission and remembering to change them back after. Use “Export with…” to apply a profile to a single export.",
        emptyState:
          "You haven't saved a profile yet. Add one and change only what a particular editor or market asks for — everything else follows your settings.",
        addItem: {
          name: "Add a profile",
          action: () => this.addProfile(),
        },
        onReorder: (from, to) => this.moveProfile(from, to),
        // Kept for the Delete/Backspace shortcut it registers, but it is not
        // the affordance anyone will find: on 1.13.4 a row that opens a page
        // renders no delete button, on hover or otherwise (Beth, 2026-08-07).
        // The one that works is inside the profile's own page.
        onDelete: (index) => this.deleteProfile(index),
        items: this.plugin.settings.profiles.map((profile) =>
          this.profileRow(profile)
        ),
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

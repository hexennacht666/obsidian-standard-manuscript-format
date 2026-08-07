import {
  App,
  PluginSettingTab,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
} from "obsidian";
import type SmfExportPlugin from "./main";
import { runningHeadName, surnameOf } from "./manuscript";
import {
  describeOverrides,
  isGlobal,
  profileFromSettings,
  type OverridableKey,
  type SmfProfile,
} from "./profiles";
import type { SmfSettings } from "./settings";

type Key = keyof SmfSettings;

/**
 * Controls inside a profile address a field of one profile rather than a
 * setting, so they carry a composite key. `getControlValue` and
 * `setControlValue` are the only two places that have to know.
 */
const PROFILE_KEY = /^profile:([^:]+):(.+)$/;

function profileKey(profile: SmfProfile, field: string): string {
  return `profile:${profile.id}:${field}`;
}

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
    const match = PROFILE_KEY.exec(key);
    if (!match) return this.plugin.settings[key as Key];

    const [, id, field] = match;
    const profile = this.plugin.settings.profiles.find((p) => p.id === id);
    if (!profile) return undefined;
    if (field === "name") return profile.name;

    // A field the profile doesn't override shows the setting it would fall
    // through to, so the page reads as the manuscript it would produce rather
    // than as a form full of blanks.
    const override = profile.overrides[field as OverridableKey];
    return override ?? this.plugin.settings[field as Key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const match = PROFILE_KEY.exec(key);
    if (!match) {
      (this.plugin.settings[key as Key] as unknown) = value;
      await this.plugin.saveSettings();
      return;
    }

    const [, id, field] = match;
    const profile = this.plugin.settings.profiles.find((p) => p.id === id);
    if (!profile) return;

    if (field === "name") {
      profile.name = String(value);
    } else {
      (profile.overrides as Record<string, unknown>)[field] = value;
    }

    await this.plugin.saveSettings();
    // The row above this page shows the profile's name and what it changes,
    // and both just moved.
    this.update();
  }

  private addProfile(): void {
    const profiles = this.plugin.settings.profiles;
    profiles.push(profileFromSettings(this.plugin.settings, "New profile", profiles));
    void this.plugin.saveSettings();
    this.update();
  }

  private deleteProfile(index: number): void {
    this.plugin.settings.profiles.splice(index, 1);
    void this.plugin.saveSettings();
    this.update();
  }

  /**
   * One page per profile, showing every field a profile may override. Fields
   * are prefilled from the settings they'd fall through to, so a new profile
   * starts where the writer already is and only the differences need touching.
   */
  private profilePage(profile: SmfProfile): SettingDefinitionPage<Key> {
    const k = (field: string) => profileKey(profile, field) as Key;

    return {
      type: "page",
      name: profile.name.trim() || "Untitled profile",
      displayValue: () => {
        const changes = describeOverrides(this.plugin.settings, profile);
        return changes.length ? changes.join(", ") : "Changes nothing yet";
      },
      items: [
        {
          name: "Name",
          desc: "Yours to choose. Most people name a profile after the market it's for.",
          control: { type: "text", key: k("name"), placeholder: "Neon Hemlock" },
        },
        {
          name: "Format",
          control: {
            type: "dropdown",
            key: k("exportFormat"),
            options: {
              docx: "Word (.docx)",
              rtf: "Rich text (.rtf)",
              both: "Both",
            },
          },
        },
        {
          name: "Font",
          control: {
            type: "dropdown",
            key: k("fontPreset"),
            options: {
              courier: "Courier New",
              times: "Times New Roman",
              custom: "Custom…",
            },
          },
        },
        {
          name: "Custom font",
          visible: () =>
            this.getControlValue(profileKey(profile, "fontPreset")) === "custom",
          control: { type: "text", key: k("customFont"), placeholder: "Georgia" },
        },
        {
          name: "Font size",
          desc: "Points.",
          control: {
            type: "number",
            key: k("fontSize"),
            min: 1,
            validate: (value) =>
              Number.isFinite(value) && value > 0
                ? undefined
                : "Enter a size greater than zero.",
          },
        },
        {
          name: "Line spacing",
          control: {
            type: "dropdown",
            key: k("lineSpacing"),
            options: { double: "Double", single: "Single" },
          },
        },
        {
          name: "Underline instead of italics",
          control: { type: "toggle", key: k("italicsAsUnderline") },
        },
        {
          name: "Strip bold",
          control: { type: "toggle", key: k("stripBold") },
        },
        {
          name: "Blind submission",
          desc: "Set by the market, and sometimes by a single call from one — which is what a profile is for.",
          control: {
            type: "dropdown",
            key: k("blindSubmission"),
            options: {
              off: "Off — name on the manuscript",
              anonymous: "Anonymous throughout",
              coverPage: "Named cover page, anonymous body",
            },
          },
        },
        {
          name: "Include content warnings",
          control: { type: "toggle", key: k("includeContentWarnings") },
        },
        {
          name: "Content warning label",
          visible: () =>
            this.getControlValue(profileKey(profile, "includeContentWarnings")) ===
            true,
          control: {
            type: "text",
            key: k("contentWarningLabel"),
            placeholder: "Content warnings",
          },
        },
        {
          type: "group",
          heading: "Contact block",
          items: [
            {
              name: "Include address",
              control: { type: "toggle", key: k("includeAddress") },
            },
            {
              name: "Include email",
              control: { type: "toggle", key: k("includeEmail") },
            },
            {
              name: "Include phone",
              control: { type: "toggle", key: k("includePhone") },
            },
          ],
        },
      ],
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
                text: `${runningHeadName(this.plugin.settings)} / TITLE / 2`,
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
            desc: "Markets disagree: some won't take .docx, some won't take .doc. Every market surveyed accepts RTF, so it's the safe answer when guidelines are vague.",
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
            desc: "Shunn specifies Courier. Times is the usual alternative — use custom when a market asks for something specific.",
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
            desc: "Double is standard format and the safe answer. Single is for a market that asks for it outright — Lightspeed does, in preference to Shunn.",
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
            name: "Underline instead of italics",
            desc: "Off means normal italics, which is what almost every market now wants. Turn on only for one that still asks for the old typewriter convention.",
            visible: () => isGlobal("italicsAsUnderline"),
            control: { type: "toggle", key: "italicsAsUnderline" },
          },
          {
            name: "Strip bold",
            desc: "Shunn's format has no bold, so on means the words survive and the emphasis doesn't. Turn off for a market whose editor asks for bold kept.",
            visible: () => isGlobal("stripBold"),
            control: { type: "toggle", key: "stripBold" },
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
            visible: () => isGlobal("includeContentWarnings"),
            control: { type: "toggle", key: "includeContentWarnings" },
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
        desc: "Named sets of changes, chosen at the moment of export and never left switched on. Adding one puts “Export with…” in the menu; with none, nothing changes.",
        emptyState:
          "No profiles. Add one to save the settings above under a name — for a market that wants something different.",
        addItem: {
          name: "Save current settings as a profile",
          action: () => this.addProfile(),
        },
        onDelete: (index) => this.deleteProfile(index),
        items: this.plugin.settings.profiles.map((profile) =>
          this.profilePage(profile)
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

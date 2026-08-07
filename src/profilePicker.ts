import { App, SuggestModal } from "obsidian";
import { describeOverrides, type SmfProfile } from "./profiles";
import type { SmfSettings } from "./settings";

interface Choice {
  /** Absent for the plain-settings entry, which is always first. */
  profile?: SmfProfile;
  label: string;
  detail: string;
}

/**
 * Asks which profile to export with, every time, defaulting to nothing.
 *
 * It deliberately does not remember the last choice. A remembered selection is
 * an active profile wearing a different hat, and the silent state it
 * reintroduces is the exact failure profiles exist to remove.
 *
 * A modal rather than a submenu because the list has to show what each profile
 * changes — that summary is what makes the extra click worth taking, and a
 * submenu has nowhere to put it.
 */
export class ProfilePicker extends SuggestModal<Choice> {
  private readonly choices: Choice[];

  constructor(
    app: App,
    settings: SmfSettings,
    profiles: SmfProfile[],
    private readonly onPick: (profile?: SmfProfile) => void
  ) {
    super(app);
    this.setPlaceholder("Export with…");
    this.choices = [
      {
        label: "Default (your settings)",
        detail: "Exactly what the settings screen shows",
      },
      ...profiles.map((profile) => {
        const changes = describeOverrides(settings, profile);
        return {
          profile,
          label: profile.name,
          detail: changes.length ? changes.join(", ") : "Changes nothing yet",
        };
      }),
    ];
  }

  getSuggestions(query: string): Choice[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return this.choices;
    return this.choices.filter((choice) =>
      choice.label.toLowerCase().includes(needle)
    );
  }

  renderSuggestion(choice: Choice, el: HTMLElement) {
    el.createDiv({ text: choice.label });
    // Small and secondary: the name is what you're choosing, the summary is
    // what stops you choosing wrongly.
    el.createEl("small", { text: choice.detail, cls: "smf-profile-detail" });
  }

  onChooseSuggestion(choice: Choice) {
    this.onPick(choice.profile);
  }
}

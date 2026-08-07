import { App, Modal, Setting } from "obsidian";

/**
 * Asks for the profile's name before creating it.
 *
 * Obsidian's declarative settings can't navigate to a sub-page from code — the
 * add affordance hands you its own button element and nothing else, and there
 * is no documented way to open a page — so adding a profile would otherwise
 * leave a row reading "New profile / changes nothing yet" and no indication
 * that anything is meant to happen next. Asking for the one field a profile
 * cannot do without makes the click a decision instead, and the row that
 * appears is already the writer's own.
 *
 * Revisit if a navigation API arrives: landing on the new profile's page would
 * be better than this, and this modal would become one field in the way.
 */
export class ProfileNameModal extends Modal {
  private name = "";

  constructor(
    app: App,
    private readonly onSubmit: (name: string) => void
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle("Name this profile");

    new Setting(this.contentEl)
      .setName("Name")
      .setDesc("Shown in the list, and when you choose it at export time.")
      .addText((text) => {
        text
          .setPlaceholder("Market or editor")
          .onChange((value) => {
            this.name = value;
          });
        // Typing is the only thing to do here, so start there.
        text.inputEl.focus();
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            this.submit();
          }
        });
      });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText("Save profile")
          .setCta()
          .onClick(() => this.submit())
      );
  }

  /**
   * An unnamed profile is still a profile — the page it opens has a name field
   * at the top, and refusing to create one would be a validation error standing
   * between the writer and the thing they asked for.
   */
  private submit() {
    this.close();
    this.onSubmit(this.name.trim());
  }

  onClose() {
    this.contentEl.empty();
  }
}

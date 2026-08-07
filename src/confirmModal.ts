import { App, Modal, Setting } from "obsidian";

/**
 * Asks before something that can't be undone.
 *
 * Deliberately rare. Re-exporting a manuscript overwrites without asking,
 * because the file is regenerable from the note and a confirmation on the
 * common case is just friction. A profile isn't regenerable — it's a set of
 * decisions about a market — so this one is worth a question.
 */
export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private readonly options: {
      title: string;
      message: string;
      confirmText: string;
      onConfirm: () => void;
    }
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle(this.options.title);
    this.contentEl.createEl("p", { text: this.options.message });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("Cancel").onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText(this.options.confirmText)
          .setDestructive()
          .setCta()
          .onClick(() => {
            this.close();
            this.options.onConfirm();
          })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

import { App, Modal, Setting } from "obsidian";

/** Asks for the one thing a new story needs before it can exist. */
export class NewStoryModal extends Modal {
  private value = "";

  constructor(app: App, private onSubmit: (title: string) => void) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText("New story");

    let inputEl: HTMLInputElement | null = null;

    new Setting(contentEl).setName("Title").addText((text) => {
      inputEl = text.inputEl;
      text.setPlaceholder("Story title").onChange((v) => (this.value = v));
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.submit();
        }
      });
    });

    new Setting(contentEl).addButton((button) =>
      button
        .setButtonText("Create")
        .setCta()
        .onClick(() => this.submit())
    );

    window.setTimeout(() => inputEl?.focus(), 0);
  }

  private submit() {
    const title = this.value.trim();
    if (!title) return;
    this.close();
    this.onSubmit(title);
  }

  onClose() {
    this.contentEl.empty();
  }
}

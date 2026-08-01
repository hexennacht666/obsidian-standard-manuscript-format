import { Notice, Plugin, TFile, normalizePath } from "obsidian";
import { buildManuscript, packDocument } from "./docx";
import { parseStory } from "./markdown";
import { DEFAULT_SETTINGS, type SmfSettings } from "./settings";
import { SmfSettingTab } from "./settingsTab";

export default class SmfExportPlugin extends Plugin {
  settings: SmfSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SmfSettingTab(this.app, this));

    this.addCommand({
      id: "export-standard-manuscript-format",
      name: "Export to Standard Manuscript Format",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.exportFile(file);
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Export to Standard Manuscript Format")
            .setIcon("file-text")
            .onClick(() => void this.exportFile(file))
        );
      })
    );
  }

  async exportFile(file: TFile) {
    try {
      const source = await this.app.vault.read(file);
      const story = parseStory(source, file.basename);

      if (!story.blocks.length) {
        new Notice("Nothing to export — that note has no body text.");
        return;
      }
      if (!this.settings.legalName && !this.settings.penName) {
        new Notice(
          "Set your name in Standard Manuscript Format Export settings first."
        );
        return;
      }

      const buffer = await packDocument(buildManuscript(story, this.settings));
      const path = await this.resolveOutputPath(file.basename);

      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        await this.app.vault.modifyBinary(existing, buffer);
      } else {
        await this.app.vault.createBinary(path, buffer);
      }

      const notice = [
        `Exported ${story.wordCount.toLocaleString()} words to ${path}`,
      ];

      // Never blocks the export and never rewrites the prose — a missing quote
      // is the writer's call to make, and a wrong guess in a manuscript is
      // worse than no guess.
      if (this.settings.warnUnclosedQuotes && story.unclosedQuotes.length) {
        const n = story.unclosedQuotes.length;
        notice.push(
          `${n} paragraph${n === 1 ? "" : "s"} may be missing a closing quote:`,
          story.unclosedQuotes
            .slice(0, 3)
            .map((u) => `  ¶${u.paragraph} ${u.excerpt}`)
            .join("\n"),
          n > 3 ? `  …and ${n - 3} more.` : ""
        );
      }

      new Notice(notice.filter(Boolean).join("\n"), notice.length > 1 ? 12000 : 5000);
    } catch (error) {
      console.error("SMF export failed", error);
      new Notice(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async resolveOutputPath(basename: string): Promise<string> {
    const folder = normalizePath(this.settings.outputFolder.trim() || "/");
    if (folder !== "/" && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const safe = basename.replace(/[\\/:*?"<>|]/g, "-");
    return folder === "/" ? `${safe}.docx` : `${folder}/${safe}.docx`;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

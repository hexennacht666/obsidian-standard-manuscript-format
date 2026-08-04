import { MarkdownView, Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import { buildManuscript, packDocument } from "./docx";
import { parseStory } from "./markdown";
import { uniquePath } from "./naming";
import { DEFAULT_SETTINGS, FONT_PRESETS, type SmfSettings } from "./settings";
import { SmfSettingTab } from "./settingsTab";

/**
 * Spelled the way it should read in Obsidian's properties panel rather than the
 * way a programmer would name a variable. The parser accepts every other
 * spelling too.
 *
 * `Short title` stays out of the scaffold deliberately — it's an override for
 * the uncommon case, and a third field on every new story is clutter for
 * someone who just wants to write.
 */
const CONTENT_WARNINGS_KEY = "Content warnings";

/**
 * Written empty, and empty means "use the filename". Obsidian forbids
 * `: / \ * " < > | ?` in filenames, so a title like "Who Goes There?" can never
 * be one — this is where it goes.
 *
 * Deliberately NOT pre-filled with the current filename. A copy of the name
 * would be correct exactly once: rename the note afterwards and the stale copy
 * would silently override the new name, putting the wrong title on a manuscript
 * with nothing to signal it. Empty can never go stale.
 */
const TITLE_KEY = "Title";

export default class SmfExportPlugin extends Plugin {
  settings: SmfSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new SmfSettingTab(this.app, this));

    this.addCommand({
      id: "export",
      name: "Export to standard manuscript format",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.exportFile(file);
        return true;
      },
    });

    this.addCommand({
      id: "new-story",
      name: "New story",
      callback: () => void this.createStory(this.defaultNewStoryFolder()),
    });

    this.addCommand({
      // The id stays as it was so any hotkey already bound to it survives the
      // rename; it's internal and never shown.
      id: "add-manuscript-properties",
      name: "Add title and content warnings",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.addManuscriptProperties(file);
        return true;
      },
    });

    this.addRibbonIcon("pencil", "New story", () =>
      void this.createStory(this.defaultNewStoryFolder())
    );

    // Right-clicking inside the note itself is a different event from the tab's
    // ⋯ menu, and plenty of people reach for it first.
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, _editor, view) => {
        const file = view?.file;
        if (!file || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Add title and content warnings")
            .setIcon("list-plus")
            .onClick(() => void this.addManuscriptProperties(file))
        );
        menu.addItem((item) =>
          item
            .setTitle("Export to standard manuscript format")
            .setIcon("file-text")
            .onClick(() => void this.exportFile(file))
        );
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        // Right-clicking a folder is where people look for "new thing here",
        // and it's a better first encounter than the command palette.
        if (file instanceof TFolder) {
          menu.addItem((item) =>
            item
              .setTitle("New story")
              .setIcon("pencil")
              .onClick(() => void this.createStory(file.path))
          );
          return;
        }

        if (!(file instanceof TFile) || file.extension !== "md") return;
        menu.addItem((item) =>
          item
            .setTitle("Export to standard manuscript format")
            .setIcon("file-text")
            .onClick(() => void this.exportFile(file))
        );
        menu.addItem((item) =>
          item
            .setTitle("Add title and content warnings")
            .setIcon("list-plus")
            .onClick(() => void this.addManuscriptProperties(file))
        );
      })
    );
  }

  private defaultNewStoryFolder(): string {
    const configured = this.settings.newStoryFolder.trim();
    if (configured) return normalizePath(configured);
    // Blank means "wherever I am" — the note you're in, else the vault root.
    return this.app.workspace.getActiveFile()?.parent?.path ?? "";
  }

  /**
   * Deliberately asks nothing. A title is often the last thing a story gets,
   * and Obsidian's own "New note" doesn't ask either — rename it whenever, or
   * never, since the exporter falls back to the filename and then to a `title`
   * property if the real title won't fit in a filename.
   */
  async createStory(folder: string) {
    try {
      const dir = folder === "/" ? "" : folder;

      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        await this.app.vault.createFolder(dir);
      }

      const path = uniquePath(
        dir,
        "Untitled story",
        (p) => this.app.vault.getAbstractFileByPath(p) !== null
      );
      const file = await this.app.vault.create(path, "");

      // processFrontMatter owns the YAML so the properties are written correctly.
      await this.app.fileManager.processFrontMatter(
        file,
        (frontmatter: Record<string, unknown>) => {
          frontmatter[TITLE_KEY] = "";
          frontmatter[CONTENT_WARNINGS_KEY] = [];
        }
      );

      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);

      // Land the cursor in the body, below the properties, ready to write.
      const view = leaf.view;
      if (view instanceof MarkdownView) {
        const editor = view.editor;
        editor.setCursor({ line: editor.lastLine(), ch: 0 });
        editor.focus();
      }
    } catch (error) {
      console.error("Could not create story", error);
      new Notice(
        `Could not create story: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async addManuscriptProperties(file: TFile) {
    try {
      const added: string[] = [];
      // Only fills in what's missing, and never prompts. Most stories have no
      // content warnings; an empty property is the correct resting state.
      await this.app.fileManager.processFrontMatter(
        file,
        (frontmatter: Record<string, unknown>) => {
          // Compared loosely, so a note that already says `contentWarnings` or
          // `title` in some other casing doesn't end up with a duplicate.
          const present = new Set(
            Object.keys(frontmatter).map((k) =>
              k.toLowerCase().replace(/[^a-z0-9]/g, "")
            )
          );
          if (!present.has("title")) {
            frontmatter[TITLE_KEY] = "";
            added.push("title");
          }
          if (!present.has("contentwarnings") && !present.has("cw")) {
            frontmatter[CONTENT_WARNINGS_KEY] = [];
            added.push("content warnings");
          }
        }
      );

      // Names only what actually changed — a note that already had one of them
      // shouldn't be told both were added.
      new Notice(
        added.length
          ? `Added ${added.join(" and ")} to ${file.basename}.`
          : `${file.basename} already has both.`
      );
    } catch (error) {
      console.error("Could not add title and content warnings", error);
      new Notice(
        `Could not add fields: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
          "Set your name in this plugin's settings first."
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
    // Typed as unknown on the way in — loadData returns whatever is on disk,
    // which is not necessarily an object at all.
    const loaded: unknown = await this.loadData();
    const data: Record<string, unknown> =
      typeof loaded === "object" && loaded !== null
        ? (loaded as Record<string, unknown>)
        : {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

    // The font used to be one free-text field. Carry an existing value over to
    // the preset it matches, or to Custom, so nobody's setting silently resets.
    const legacy = data.font;
    if (typeof legacy === "string" && data.fontPreset === undefined) {
      const name = legacy.trim();
      const preset = (
        Object.keys(FONT_PRESETS) as (keyof typeof FONT_PRESETS)[]
      ).find((k) => FONT_PRESETS[k].toLowerCase() === name.toLowerCase());

      if (preset) {
        this.settings.fontPreset = preset;
      } else if (name) {
        this.settings.fontPreset = "custom";
        this.settings.customFont = name;
      }
      delete (this.settings as unknown as Record<string, unknown>).font;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

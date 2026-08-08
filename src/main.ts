import { MarkdownView, Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import { buildManuscript, packDocument } from "./docx";
import { parseStory } from "./markdown";
import { buildRtf } from "./rtf";
import { uniquePath } from "./naming";
import { ProfilePicker } from "./profilePicker";
import {
  describeOverrides,
  resolveProfile,
  sanitizeProfiles,
  type SmfProfile,
} from "./profiles";
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

/**
 * Left empty, and empty means "derive it". The running head takes two keywords
 * from the title, which is right often enough to be a default and wrong for a
 * title whose first words aren't the memorable ones.
 *
 * It stays out of the *new story* scaffold — a third field in front of someone
 * who just wants to write — but it belongs here. This command is where a writer
 * goes to ask what a manuscript can carry, and Beth went looking for it here
 * (2026-08-07) before anywhere else.
 */
const SHORT_TITLE_KEY = "Short title";

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

    // Appears only once a profile exists, so the command palette looks exactly
    // as it always did for anyone who never makes one.
    this.addCommand({
      id: "export-with-profile",
      name: "Export with…",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!this.settings.profiles.length) return false;
        if (!checking) this.pickProfileThenExport(file);
        return true;
      },
    });

    this.addCommand({
      id: "new-story",
      name: "New story",
      callback: () => void this.createStory(this.defaultNewStoryFolder()),
    });

    this.addCommand({
      // The id stays as it was so any hotkey already bound to it survives a
      // rename; it's internal and never shown. The visible name lists the
      // fields outright: "manuscript properties" is Obsidian's word for the
      // mechanism and tells a writer nothing about what they'd get. Long, but
      // every word in it is one someone would search for.
      id: "add-manuscript-properties",
      name: "Add title, short title and content warnings",
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
            .setTitle("Add title, short title and content warnings")
            .setIcon("list-plus")
            .onClick(() => void this.addManuscriptProperties(file))
        );
        menu.addItem((item) =>
          item
            .setTitle("Export to standard manuscript format")
            .setIcon("file-text")
            .onClick(() => void this.exportFile(file))
        );
        if (this.settings.profiles.length) {
          menu.addItem((item) =>
            item
              .setTitle("Export with…")
              .setIcon("file-cog")
              .onClick(() => this.pickProfileThenExport(file))
          );
        }
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
        if (this.settings.profiles.length) {
          menu.addItem((item) =>
            item
              .setTitle("Export with…")
              .setIcon("file-cog")
              .onClick(() => this.pickProfileThenExport(file))
          );
        }
        menu.addItem((item) =>
          item
            .setTitle("Add title, short title and content warnings")
            .setIcon("list-plus")
            .onClick(() => void this.addManuscriptProperties(file))
        );
      })
    );
  }

  private pickProfileThenExport(file: TFile) {
    new ProfilePicker(
      this.app,
      this.settings,
      this.settings.profiles,
      (profile) => void this.exportFile(file, profile)
    ).open();
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

      if (dir) await this.ensureFolder(dir);

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
          if (!present.has("shorttitle")) {
            frontmatter[SHORT_TITLE_KEY] = "";
            added.push("short title");
          }
          if (!present.has("contentwarnings") && !present.has("cw")) {
            frontmatter[CONTENT_WARNINGS_KEY] = [];
            added.push("content warnings");
          }
        }
      );

      // Names only what actually changed — a note that already had one of them
      // shouldn't be told both were added.
      const list =
        added.length > 2
          ? `${added.slice(0, -1).join(", ")} and ${added[added.length - 1]}`
          : added.join(" and ");

      new Notice(
        added.length
          ? `Added ${list} to ${file.basename}.`
          : `${file.basename} already has them.`
      );
    } catch (error) {
      console.error("Could not add title and content warnings", error);
      new Notice(
        `Could not add fields: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async exportFile(file: TFile, profile?: SmfProfile) {
    try {
      // Everything past this line reads the resolved settings, never
      // `this.settings` — a path that missed the profile would produce a
      // manuscript that disagrees with the notice describing it.
      const settings = resolveProfile(this.settings, profile);

      const source = await this.app.vault.read(file);
      const story = parseStory(source, file.basename, {
        stripBold: settings.stripBold,
      });

      if (!story.blocks.length) {
        new Notice("Nothing to export — that note has no body text.");
        return;
      }
      // An anonymous manuscript prints no name anywhere, so demanding one first
      // would block the writer who only ever submits blind. Every other
      // arrangement puts the name on the page and still needs it.
      if (
        settings.blindSubmission !== "anonymous" &&
        !settings.legalName &&
        !settings.penName
      ) {
        new Notice(
          "Set your name in this plugin's settings first."
        );
        return;
      }

      const written: { path: string; replaced: boolean }[] = [];

      if (settings.exportFormat !== "rtf") {
        const buffer = await packDocument(buildManuscript(story, settings));
        written.push(await this.writeExport(file.basename, "docx", buffer));
      }
      if (settings.exportFormat !== "docx") {
        const rtf = buildRtf(story, settings);
        written.push(await this.writeExport(file.basename, "rtf", rtf));
      }

      // Re-exporting overwrites, deliberately — that's why a story revised
      // thirty times leaves one manuscript behind rather than thirty. Each file
      // says which happened to it: exporting both formats can replace one and
      // create the other, and a single verb for the pair would be wrong about
      // one of them.
      const wrote = written
        .map((w, i) => {
          const verb = w.replaced ? "Replaced" : "Wrote";
          return `${i === 0 ? verb : verb.toLowerCase()} ${w.path}`;
        })
        .join(", ");

      const notice = [`${wrote} — ${story.wordCount.toLocaleString()} words`];

      // Every export says what it applied. The risk in an override isn't the
      // override; it's silent divergence between what the settings screen shows
      // and what the file contains, and saying it out loud at the moment of
      // export leaves no state to be surprised by later.
      if (profile) {
        const changes = describeOverrides(this.settings, profile);
        notice.push(
          changes.length
            ? `Exported with ${profile.name} — ${changes.join(", ")}`
            : `Exported with ${profile.name} — same as your current settings`
        );
      }

      // Never blocks the export and never rewrites the prose — a missing quote
      // is the writer's call to make, and a wrong guess in a manuscript is
      // worse than no guess.
      if (settings.warnUnclosedQuotes && story.unclosedQuotes.length) {
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

  /**
   * Writes one rendering, replacing the previous one rather than accumulating
   * copies — so a story that gets exported thirty times while it's being
   * revised leaves one file behind, not thirty.
   */
  private async writeExport(
    basename: string,
    extension: "docx" | "rtf",
    data: ArrayBuffer | string
  ): Promise<{ path: string; replaced: boolean }> {
    const path = await this.resolveOutputPath(basename, extension);
    const existing = this.app.vault.getAbstractFileByPath(path);
    const replaced = existing instanceof TFile;

    if (typeof data === "string") {
      if (existing instanceof TFile) await this.app.vault.modify(existing, data);
      else await this.app.vault.create(path, data);
    } else if (existing instanceof TFile) {
      await this.app.vault.modifyBinary(existing, data);
    } else {
      await this.app.vault.createBinary(path, data);
    }

    return { path, replaced };
  }

  /**
   * Creates the folder if it isn't there. Tests for a *folder* rather than for
   * anything at all: a file sitting at that path would otherwise look like a
   * folder that already exists, and the write would fail somewhere less
   * legible than here.
   */
  private async ensureFolder(path: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFolder) return;
    if (existing) {
      throw new Error(`${path} is a file, not a folder.`);
    }
    await this.app.vault.createFolder(path);
  }

  private async resolveOutputPath(
    basename: string,
    extension: "docx" | "rtf"
  ): Promise<string> {
    const folder = normalizePath(this.settings.outputFolder.trim() || "/");
    if (folder !== "/") await this.ensureFolder(folder);
    const safe = basename.replace(/[\\/:*?"<>|]/g, "-");
    const name = `${safe}.${extension}`;
    return folder === "/" ? name : `${folder}/${name}`;
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

    // Every menu and command asks whether any profile exists, so a data.json
    // that says something other than a list here would break the plugin at
    // load rather than at export.
    this.settings.profiles = sanitizeProfiles(data.profiles);

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

    // Emphasis used to be a boolean — underline instead of italics — until a
    // market asked for literal underscores and a third mode couldn't be a
    // toggle. Carry the old answer over so nobody's setting silently resets.
    const legacyUnderline = data.italicsAsUnderline;
    if (typeof legacyUnderline === "boolean" && data.emphasis === undefined) {
      this.settings.emphasis = legacyUnderline ? "underline" : "italic";
      delete (this.settings as unknown as Record<string, unknown>).italicsAsUnderline;
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

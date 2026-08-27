# Standard Manuscript Format Export

An Obsidian plugin that exports a story to [Shunn's Standard Manuscript Format](https://www.shunn.net/format/story/) as a `.docx` or `.rtf`, ready to submit.

Write in markdown. Get back a manuscript that looks like every editor expects one to look.

Free, runs on your phone as well as at your desk, and never connects to the internet at all.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/dark-1-story-note.png">
  <img alt="A story open in Obsidian with its Title and Content warnings properties, and the exported manuscript sitting beside it in the Manuscripts folder" src="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/light-1-story-note.png">
</picture>

- **Two formats**, because markets disagree about which they accept.
- **Shunn modern format**, with a running head on every page but the title page.
- **Typographic cleanup** — curly quotes, em dashes, ellipses, and wrong-way quotes fixed.
- **Word count** of the story only, so front matter never inflates it.
- **Blind submission**, in the two configurations markets require.
- **Content warnings** from the story's own properties, where the market wants them.
- **Export profiles**, so a market with unusual requirements is one choice at export time.

## Install

From Obsidian: **Settings → Community plugins → Browse**, search for *Standard Manuscript Format Export*, install, and enable it.

Manually: download `main.js` and `manifest.json` from the [latest release](../../releases/latest) into `<your vault>/.obsidian/plugins/standard-manuscript-format/`, then enable the plugin in **Settings → Community plugins**.

**Requires Obsidian 1.13 or later.** That's where Obsidian's declarative settings API arrives, which is what makes every setting here findable from settings search.

Works on desktop and mobile. It's pure JavaScript with no desktop-only dependencies, so a manuscript can be exported from a phone.

## Quick start

**Set your name.** Open **Settings → Standard Manuscript Format Export → Author identity** and fill in at least your name. The contact block needs it, and export will refuse without it. The row shows the name it will print, so a wrong guess is caught here rather than by an editor.

**Start a story.** Click the pencil icon in the left sidebar, or run **New story** from the command palette, or right-click a folder in the file list. You get a note with its properties ready and the cursor in the body. It asks nothing.

**Write.** Type `***` on its own line wherever you want a scene break.

**Export.** Run **Export to standard manuscript format** from the command palette, or right-click the note. The manuscript is written to your `Manuscripts` folder.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/dark-3-commands.png">
  <img alt="Obsidian's command palette listing the plugin's four commands: New story, Export with, Add title and content warnings, and Export to standard manuscript format" src="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/light-3-commands.png">
</picture>

That's the whole loop. A story with no properties at all exports fine, and an old note from years ago needs nothing done to it.

## Your story stays yours

**This plugin never connects to the internet.** It sends nothing and it fetches nothing. Not for updates, not for telemetry, not for anything. There is no `fetch`, no `XMLHttpRequest`, no WebSocket and no analytics anywhere in the shipped bundle.

Everything happens on your own device. No round trip to a server, no account, no subscription, no LLM in the loop. Your manuscripts are written as ordinary files alongside your notes, and your stories stay ordinary markdown. If this plugin disappeared tomorrow, you'd lose a menu command and nothing else.

It also never touches your clipboard, executes no code of its own or yours, and writes nothing outside the output folder you choose.

**It changes your punctuation, never your words.** Quotes get curled, `--` becomes an em dash, `...` becomes an ellipsis. Nothing else in your prose is altered, nothing is rewritten, and anything that looks questionable is mentioned to you rather than corrected.

## What it does

**Two formats, because markets disagree.** `.docx` and `.rtf`, the same manuscript either way. Some markets won't take `.doc`; others won't take `.docx`; every market surveyed takes RTF, so it's the safe answer when guidelines are vague or an uploader is fussy. Export one or both.

**Shunn modern format.** Title page with your contact block upper-left and the word count upper-right, title and byline centred below. Story starts on page 2.

**Running head** on every page but the title page: `Surname / Short title / page`. Set a surname, or leave it blank if your last name is a single word. Settings shows what will print, so you can check it before an editor sees it a dozen times.

**Manuscript layout.** 12pt Times New Roman, 1" margins, double-spaced, 0.5" first-line indent, centred `#` for scene breaks and a centred END after the last line.

**Typographic cleanup.** Straight quotes become curly, `--` becomes an em dash, `...` becomes an ellipsis. Quotes that are *already* curly get re-derived from context, so a wrong-way quote — the usual souvenir of pasting between editors — gets fixed rather than passed through.

**A missing quote mark won't ruin everything after it.** Forget a closing quotation mark and most editors turn every quote that follows the wrong way round, so one slip can leave a whole story looking broken. Not here: the mistake stays where you made it and the rest of your dialogue is still correct.

The export works either way. Afterwards it tells you which paragraphs look like they're missing a closing quote, so you can go and check them. Dialogue that runs over several paragraphs, opening each one and closing only the last, is normal and never flagged. Nothing is fixed for you, and you can switch the warning off.

**Word count** of the story only, not your title page or content warnings.

**Obsidian syntax never reaches the page.** Wikilinks, markdown links, `%%comments%%`, and highlights are stripped or unwrapped.

**No bold by default**, because the format has none. `**bold**` arrives as plain text — the words survive, the emphasis doesn't — and `***both***` keeps its italics. Emphasis in a manuscript is italic, or underline for the markets still on the typewriter convention, and both are already here. Editors do occasionally ask for bold kept, so it's a setting rather than a rule.

**Blind submission**, in the two configurations markets require. *Anonymous throughout* removes your name from the contact block, the byline and the running head. *Identified cover page* keeps the title page and removes your name from every page after it. Both also strip the author name that gets embedded invisibly inside a `.docx`, which survives every precaution taken on the visible page.

**Export profiles.** Save a market's or an editor's particular requirements, then pick them at the moment of export. Markets have quirks, you submit to the same ones repeatedly, and this means not adjusting the same six settings every time. **Export with…** always offers your normal settings first and never remembers your last choice, so a profile can't stay switched on by accident. A profile saves only what you actually changed, so a setting you adjust later still reaches a profiled export.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/dark-4-profiles.png">
  <img alt="The Export with picker, offering Default (your settings) first, then two saved profiles: Anonymous RTF, and Courier single-spaced" src="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/light-4-profiles.png">
</picture>

## Writing for the exporter

### Scene breaks

Type `***` on a line of its own. It exports as the centred `#` that a manuscript wants.

A bare `#` works too, and is what most writers reach for — but Obsidian reads it as an empty heading, so it renders as a blank H1 and turns up in the Outline pane and in `[[note#` autocomplete. `---` and `___` work as well, though `---` sitting directly under a paragraph turns that paragraph into a heading. `***` is the one with no side effects.

### Title and content warnings

Stories can have two optional properties: a title, and content warnings.

**New story** gives you a note with both already set up. To add them to a story you've already written, run **Add title and content warnings** from the command palette, the note's ⋯ menu, or by right-clicking the note. Either way, nothing is filled in for you.

Obsidian shows them as fields at the top of the note: you type the title into a box, and add each content warning by clicking a plus. Behind those fields it stores this, though you won't normally see it or type it:

```yaml
---
Title:
Content warnings:
  - body horror
  - animal death
---
```

The names are matched loosely, so `Content warnings`, `contentWarnings`, `content_notes` and `cw` all work.

**Leave `Title` empty and the title comes from the note**: the first heading if there is one, otherwise the filename, so renaming the note renames the manuscript. Fill it in and it wins. It's there because Obsidian forbids `: / \ * " < > | ?` in filenames, and plenty of titles need them — *Who Goes There?* can never be a filename, and neither can anything with a subtitle.

**Content warnings** print on the title page by default, under the byline, where a slush reader meets them before the story — or with the story, set apart before the first line, for the markets that ask for that instead. A comma-separated line or an inline array works just as well as a list. Settings control the label and whether they print at all. You write the warnings on each story.

### If the running head is wrong for one story

The running head takes two keywords from the title, in the title's own case, ignoring any subtitle and any leading *the*, *a* or *of*. That's right nearly always.

When it isn't, add a `Short title` property to that story and it wins. Nothing puts this property there for you and nothing mentions it: it's the escape hatch for the rare story that needs it, not a field to fill in.

## Settings

**Author identity** is one row that opens a page of its own: legal name, pen name, pronouns, address, email, phone, and a membership line. Address, email and phone each have a toggle, because markets differ on which they want. Blind submission is here too, beside the settings it overrides, and switching it to anonymous hides those toggles, since nothing they control gets printed. You set this once and it stays out of the way.

**Manuscript** options cover font (Times, Courier, or a custom face for a market that asks for one), size, line spacing, emphasis (italics, underline for markets still on the typewriter convention, or literal underscores for one that asks to see them), strip-bold, word-count rounding (which prints *about 3,400 words* rather than *3,442 words*), the end marker, the content-warning label, and whether unclosed quotes get mentioned.

**Folders** — where the manuscript is written, and where new stories go. Both pick from the folders in your vault rather than asking you to type a path, so a misspelling can't quietly create a second folder.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/dark-2-settings.png">
  <img alt="The plugin's settings: an Author identity row showing the name it will print, then Manuscript options for format, font, size, line spacing, word-count rounding and end marker, each with a line explaining when to change it" src="https://raw.githubusercontent.com/hexennacht666/obsidian-standard-manuscript-format/HEAD/images/light-2-settings.png">
</picture>

Every setting is findable from Obsidian's settings search.

## Troubleshooting

**My RTF has no running head in Pages.** It never will. macOS's RTF reader has no representation for page headers at all, so an RTF looks header-less there even when it's correct. **Check RTF in Word**, which is what the markets requesting RTF will open it in.

**My RTF shows the running head on the title page in Google Docs.** Google's RTF importer flattens headers to the whole document. The same story exported as `.docx` is correct in Google Docs, so this is the importer rather than the manuscript. Again: check RTF in Word.

**My bold went missing.** Deliberate — standard manuscript format has no bold, so the words survive and the emphasis doesn't. If an editor has asked you to keep it, turn off strip-bold in settings.

**The running head shows the wrong part of my name.** Left blank, it takes the last word of your name, which is wrong for any surname of more than one word. Set the surname explicitly in **Author identity**.

**Where did my manuscript go?** The output folder in settings, `Manuscripts` by default. Exports live in your vault, one file per story, and re-exporting replaces the file rather than piling up copies. A compressed manuscript is about the size of the note it came from, so a folder of them costs roughly what your stories already cost. Drag them out if you'd rather they lived elsewhere.

**Export says it needs a name.** The contact block can't be built without one. **Settings → Author identity**.

## What this doesn't do

**Shared editing or comments.** Obsidian is single-user by design, and link-and-drop-in feedback isn't something a plugin can add to it. If you need a co-writer in the document with you, use another tool.

**Multi-note stories.** A story is one note. Assembling a manuscript from a folder of scene notes is a novel-writing shape, and it imposes structure on a short story that didn't ask for it.

**A list of markets.** Deliberately absent. Guidelines go stale, and a plugin that quietly formats to an out-of-date one is worse than a plugin that never claimed to know. Read the guidelines, then set the settings.

If you want any of these, or something else, [open an issue](../../issues). What gets built next is decided by what people ask for.

## Development

```bash
npm install
npm run dev     # watch build
npm test        # unit tests
npm run lint    # official Obsidian plugin guidelines
npm run build   # typecheck and production bundle
```

Render a story without going through Obsidian — the output extension picks the emitter:

```bash
npm run sample -- path/to/story.md out.docx
npm run sample -- path/to/story.md out.rtf
```

The core (`src/markdown.ts`, `src/typography.ts`, `src/manuscript.ts`, `src/docx.ts`, `src/rtf.ts`) has no Obsidian imports, so it stays testable in plain Node and reusable by other tools. `manuscript.ts` holds what both emitters agree on — the contact block, the word count, the running head — so the two renderings can't drift apart.

## Licence

MIT

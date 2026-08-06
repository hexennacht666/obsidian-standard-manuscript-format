# Standard Manuscript Format Export

An Obsidian plugin that exports a story to [Shunn's Standard Manuscript Format](https://www.shunn.net/format/story/) as a `.docx` or `.rtf`, ready to submit.

Write in markdown. Get back a manuscript that looks like every editor expects one to look.

## What it does

- **Two formats, because markets disagree.** `.docx` and `.rtf`, the same manuscript either way. Clarkesworld won't take `.doc`; Beneath Ceaseless Skies won't take `.docx`; every market surveyed takes RTF, so it's the safe answer when guidelines are vague or an uploader is fussy. Export one or both.
- **Shunn modern format.** Title page with your contact block upper-left and the word count upper-right, title and byline centred below. Story starts on page 2.
- **Running head** on every page but the title page: `Surname / KEYWORD / page`.
- **Manuscript layout**: 12pt Courier New, 1" margins, double-spaced, 0.5" first-line indent, centred `#` for scene breaks.
- **Typographic cleanup.** Straight quotes become curly, `--` becomes an em dash, `...` becomes an ellipsis. Quotes that are *already* curly get re-derived from context, so a wrong-way quote — the usual souvenir of pasting between editors — gets fixed rather than passed through.
- **Forgiving about unclosed quotes.** Forget a closing quote and the quotes after it don't invert; the mistake stays where you made it. The export still succeeds, and afterwards it mentions any paragraph that opened dialogue and neither closed it nor carried it into the next paragraph. Multi-paragraph speech, which opens every paragraph and closes only the last, is never reported. Nothing is ever silently rewritten, and the whole check can be switched off.
- **Word count** of the body only — front matter never inflates it — with the traditional round-to-nearest-100 on by default.
- **Vault syntax never reaches the page.** Wikilinks, markdown links, `%%comments%%`, and highlights are stripped or unwrapped.
- **No bold by default**, because the format has none. `**bold**` arrives as plain text — the words survive, the emphasis doesn't — and `***both***` keeps its italics. Emphasis in a manuscript is italic, or underline for the markets still on the typewriter convention, and both are already here. Editors do occasionally ask for bold kept, so it's a setting rather than a rule.
- **Blind submission**, in the two arrangements markets actually ask for. *Anonymous throughout* removes the contact block, the byline and your name from the running head — what Escape Pod and Clarion West want. *Identified cover page* keeps the title page intact and takes your name off every page after it, which is what contests like Writers of the Future require and disqualify entries for missing. Both also neutralise the author name embedded in the `.docx` properties, which survives every precaution taken on the visible page.
- Pure JavaScript throughout, so it runs on Obsidian mobile as well as desktop.

## Use

**New story** — from the pencil in the left ribbon, the command palette or by right-clicking a folder in the file explorer. It asks nothing: you get a note with its properties ready and the cursor in the body. Name it whenever you like, or never — a story titled `Untitled story` still exports, and if the real title won't fit in a filename, put it in the `title` property.

**Add title and content warnings** — from the command palette, the note's ⋯ menu, or right-clicking either the note in the file explorer or the text you're writing in.

**Export to standard manuscript format** — from the command palette, or by right-clicking a note. The manuscript is written to the folder set in settings (`Manuscripts` by default), in whichever format you've chosen.

Exports live in your vault, one file per story — re-exporting replaces it rather than piling up copies. A manuscript is about the size of the note it came from, so a folder of them costs roughly what your stories already cost. Drag them out if you'd rather they lived elsewhere.

Set your name in settings before the first export — the contact block needs it.

Nothing else is required. A story with no properties at all exports fine: the title falls back to the first heading, then the filename, and a story with no content warnings simply doesn't print that line. An old note from years ago needs nothing done to it. If you do want the fields on an existing story, **Add title and content warnings** puts them there — on that one note, when you ask, without prompting you for values.

### Per-story frontmatter

Facts about the story itself, all optional:

```yaml
---
Title:
Content warnings:
  - body horror
  - animal death
---
```

You won't normally type this by hand — **New story** puts the property there, and Obsidian shows it as a list you add to with a click. Property names are matched loosely, so `Content warnings`, `contentWarnings`, `content_notes` and `cw` are all the same thing.

**Leave `Title` empty and the filename is the title**, so renaming the note renames the manuscript. Fill it in and it wins. It's there because Obsidian forbids `: / \\ * " < > | ?` in filenames, and plenty of titles need them — *Who Goes There?* can never be a filename, and neither can anything with a subtitle.

It is deliberately not pre-filled with the current filename. A copy of the name would be right exactly once; rename the note afterwards and the stale copy would quietly override the new name, putting the wrong title on a manuscript with nothing to show for it. Empty can't go stale.

`Short title` is a third, rarer override, for choosing the running head's keyword yourself instead of letting the plugin pick the most distinctive word.

Content warnings print on the title page, under the byline, where a slush reader meets them before the story. A comma-separated line or an inline array works just as well as a list. The label, and whether they print at all, are in settings; the warnings themselves belong to the story.

Without a `Title` property the plugin uses the first heading in the note, then the filename. Without `Short title` it picks the most distinctive word from the title, ignoring any subtitle.

## Settings

**Author identity** sits behind one row — legal name, pen name, pronouns, address, email, phone, membership line, with per-export toggles for address, email, and phone, since markets differ on what they want. Blind submission lives here too, next to the settings it overrides; when it's set to anonymous, the include-toggles hide, because nothing they control is printed. It's set once, so it stays out of the way of the options you change per market. The row shows the name it will print — or says the manuscript carries no name — and flags itself if there isn't one yet.

**Manuscript** options cover font (Courier, Times, or a custom face for a market that asks for one), size, underline-instead-of-italics for markets still on the typewriter convention, strip-bold (on, and turned off for the market whose editor wants it kept), word-count rounding, the end marker, the content-warning label, and whether unclosed quotes get mentioned.

**Folders** — where the `.docx` is written, and where new stories go. Both pick from the folders in your vault rather than asking you to type a path, so a misspelling can't quietly create a second folder.

Settings are declared rather than drawn, so every one of them is findable from Obsidian's settings search.

Everything the plugin does uses Obsidian's documented API. It makes no network requests, executes no code of its own or yours, never touches the clipboard, and writes nothing outside the output folder.

Deliberately absent: any built-in list of markets. Guidelines go stale, and a plugin that quietly formats to an out-of-date one is worse than a plugin that never claimed to know.

## Development

```bash
npm install
npm run dev     # watch build
npm test        # markdown + typography unit tests
npm run lint    # official Obsidian plugin guidelines
npm run build   # typecheck and production bundle
```

Requires Obsidian 1.13 or later, which is where the declarative settings API arrives.

Render a story without going through Obsidian — the output extension picks the emitter:

```bash
npm run sample -- path/to/story.md out.docx
```

```bash
npm run sample -- path/to/story.md out.rtf
```

The core (`src/markdown.ts`, `src/typography.ts`, `src/manuscript.ts`, `src/docx.ts`, `src/rtf.ts`) has no Obsidian imports, so it stays testable in plain Node and reusable by other tools. `manuscript.ts` holds what both emitters agree on — the contact block, the word count, the running head — so the two renderings can't drift apart.

## Licence

MIT

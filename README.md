# Standard Manuscript Format Export

An Obsidian plugin that exports a story to [Shunn's Standard Manuscript Format](https://www.shunn.net/format/story/) as a `.docx`, ready to submit.

Write in markdown. Get back a manuscript that looks like every editor expects one to look.

## What it does

- **Shunn modern format.** Title page with your contact block upper-left and the word count upper-right, title and byline centred below. Story starts on page 2.
- **Running head** on every page but the title page: `Surname / KEYWORD / page`.
- **Manuscript layout**: 12pt Courier New, 1" margins, double-spaced, 0.5" first-line indent, centred `#` for scene breaks.
- **Typographic cleanup.** Straight quotes become curly, `--` becomes an em dash, `...` becomes an ellipsis. Quotes that are *already* curly get re-derived from context, so a wrong-way quote — the usual souvenir of pasting between editors — gets fixed rather than passed through.
- **Forgiving about unclosed quotes.** Forget a closing quote and the quotes after it don't invert; the mistake stays where you made it. The export still succeeds, and afterwards it mentions any paragraph that opened dialogue and neither closed it nor carried it into the next paragraph. Multi-paragraph speech, which opens every paragraph and closes only the last, is never reported. Nothing is ever silently rewritten, and the whole check can be switched off.
- **Word count** of the body only — front matter never inflates it — with the traditional round-to-nearest-100 on by default.
- **Vault syntax never reaches the page.** Wikilinks, markdown links, `%%comments%%`, and highlights are stripped or unwrapped.
- Pure JavaScript throughout, so it runs on Obsidian mobile as well as desktop.

## Use

**New story** — from the pencil in the left ribbon, the command palette, the "Create new story" line in an empty pane, or by right-clicking a folder in the file explorer. Asks for a title, creates the note with its properties ready, and opens it.

**Add manuscript properties** — from the command palette, the note's ⋯ menu, or right-clicking either the note in the file explorer or the text you're writing in.

**Export to Standard Manuscript Format** — from the command palette, or by right-clicking a note. The `.docx` is written to the folder set in settings (`Manuscripts` by default).

Set your name in settings before the first export — the contact block needs it.

Nothing else is required. A story with no properties at all exports fine: the title falls back to the first heading, then the filename, and a story with no content warnings simply doesn't print that line. An old note from years ago needs nothing done to it. If you do want the properties on an existing story, **Add manuscript properties** puts them there — on that one note, when you ask, without prompting you for values.

### Per-story frontmatter

Facts about the story itself, all optional:

```yaml
---
title: The Salt Year
shortTitle: SALT
contentWarnings:
  - body horror
  - animal death
---
```

Content warnings print on the title page, under the byline, where a slush reader meets them before the story. A comma-separated line (`cw: violence, grief`) or an inline array works just as well as a block list, and `contentNotes` / `content_warnings` / `cw` are all accepted spellings. The label and whether they print at all are in settings; the warnings themselves belong to the story.

Without `title`, the plugin uses the first heading in the note, then the filename. Without `shortTitle`, it picks the most distinctive word from the title for the running head.

## Settings

Author identity (legal name, pen name, pronouns, address, email, phone, membership line) with per-export toggles for address, email, and phone — markets differ on what they want.

Manuscript options cover font (Courier, Times, or a custom face for a market that asks for one), size, underline-instead-of-italics for markets still on the typewriter convention, word-count rounding, the end marker, the content-warning label, the output folder, and whether unclosed quotes get mentioned.

Deliberately absent: any built-in list of markets. Guidelines go stale, and a plugin that quietly formats to an out-of-date one is worse than a plugin that never claimed to know.

## Development

```bash
npm install
npm run dev     # watch build
npm test        # markdown + typography unit tests
npm run build   # typecheck and production bundle
```

Render a story to `.docx` without going through Obsidian:

```bash
npm run sample -- path/to/story.md out.docx
```

The core (`src/markdown.ts`, `src/typography.ts`, `src/docx.ts`) has no Obsidian imports, so it stays testable in plain Node and reusable by other tools.

## Licence

MIT

/** Appends a counter until the path is free. */
export function uniquePath(
  folder: string,
  fileName: string,
  exists: (path: string) => boolean
): string {
  const at = (name: string) =>
    folder === "" || folder === "/" ? `${name}.md` : `${folder}/${name}.md`;

  if (!exists(at(fileName))) return at(fileName);
  for (let n = 2; n < 1000; n++) {
    if (!exists(at(`${fileName} ${n}`))) return at(`${fileName} ${n}`);
  }
  return at(`${fileName} ${Date.now()}`);
}

/**
 * The names a note carries when nobody has titled it: Obsidian's own `Untitled`
 * series, and the `Untitled story` that **New story** creates.
 */
const PLACEHOLDER_NAME = /^untitled(?: story)?(?: \d+)?$/i;

export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_NAME.test(name.trim());
}

/** What a placeholder-named note can be named from, in the order they win. */
export interface StoryName {
  /** The opening heading, verbatim. */
  heading: string | null;
  /** `Short title` as the frontmatter states it — never the derived one. */
  shortTitle: string | null;
  /** `Title` as the frontmatter states it. */
  title: string | null;
}

/**
 * What the manuscript file is called.
 *
 * A note the writer named keeps its name. Variants of one story are separate
 * notes distinguished only by filename — `Salt Year v2` beside `Salt Year` —
 * and the title never changes between them, so resolving every export from the
 * title would make the pair overwrite each other.
 *
 * A note still carrying a placeholder name has no such name to protect, so it
 * takes one from the story. The heading comes first because in Obsidian the
 * opening heading and the note's name are the same thing, and each candidate is
 * used exactly as written: a title too long to be a filename is what
 * `Short title` is for, and it is asked for first.
 */
export function exportBasename(basename: string, story: StoryName): string {
  if (!isPlaceholderName(basename)) return basename;
  for (const candidate of [story.heading, story.shortTitle, story.title]) {
    const stated = (candidate ?? "").trim();
    if (stated && !isPlaceholderName(stated)) return stated;
  }
  return basename;
}

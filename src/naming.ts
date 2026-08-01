/** Characters no vault should carry in a filename, on any OS. */
const ILLEGAL = /[\\/:*?"<>|#^[\]]/g;

export interface StoryFileName {
  fileName: string;
  /**
   * True when the title had to be altered to be a legal filename — a colon is
   * the common case ("The Salt Year: A Fragment"). The real title then has to
   * be written into frontmatter, or the manuscript loses its punctuation.
   */
  needsTitleOverride: boolean;
}

export function toStoryFileName(title: string): StoryFileName {
  const trimmed = title.trim();
  const fileName = trimmed
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();

  return {
    fileName: fileName || "Untitled story",
    needsTitleOverride: fileName !== trimmed,
  };
}

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

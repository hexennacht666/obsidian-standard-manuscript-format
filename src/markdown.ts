import { smartTypography } from "./typography";

export interface Run {
  text: string;
  italic?: boolean;
  bold?: boolean;
}

export type Block =
  | { kind: "para"; runs: Run[] }
  | { kind: "sceneBreak" };

export interface ParsedStory {
  title: string | null;
  shortTitle: string | null;
  frontmatter: Record<string, string>;
  blocks: Block[];
  wordCount: number;
}

const SCENE_BREAK = /^(#|\*(\s*\*){2,}|-{3,}|_{3,}|<hr\s*\/?>)$/;

const TITLE_STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "but",
  "with", "from", "by", "as", "is", "it", "its", "was", "were", "be", "been",
  "would", "should", "could", "will", "shall", "do", "does", "did", "that",
  "this", "these", "those", "all", "only",
]);

function splitFrontmatter(source: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const frontmatter: Record<string, string> = {};
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter, body: source };

  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    frontmatter[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  return { frontmatter, body: source.slice(match[0].length) };
}

/** Strip the Obsidian-isms that should never reach an editor's desk. */
function stripVaultSyntax(text: string): string {
  return text
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/!?\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function pushRun(runs: Run[], text: string, italic: boolean, bold: boolean) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && !!last.italic === italic && !!last.bold === bold) {
    last.text += text;
    return;
  }
  runs.push({ text, italic: italic || undefined, bold: bold || undefined });
}

/**
 * `_` only opens on a word boundary, so snake_case survives intact — which
 * matters because invented names in speculative fiction are full of them.
 */
function underscoreDelimits(text: string, i: number, len: number): boolean {
  const before = i > 0 ? text[i - 1] : " ";
  const after = i + len < text.length ? text[i + len] : " ";
  const opensHere = /[^A-Za-z0-9]/.test(before) && !/\s/.test(after || " ");
  const closesHere = !/\s/.test(before) && /[^A-Za-z0-9]/.test(after);
  return opensHere || closesHere;
}

export function parseInline(input: string): Run[] {
  const runs: Run[] = [];
  let buf = "";
  let italic = false;
  let bold = false;

  for (let i = 0; i < input.length; ) {
    const c = input[i];

    if (c === "\\" && i + 1 < input.length) {
      buf += input[i + 1];
      i += 2;
      continue;
    }

    const isStar = c === "*";
    const isUnderscore = c === "_";
    if (!isStar && !isUnderscore) {
      buf += c;
      i += 1;
      continue;
    }

    const marker = input.slice(i).match(isStar ? /^\*{1,3}/ : /^_{1,3}/);
    const len = marker ? marker[0].length : 1;

    if (isUnderscore && !underscoreDelimits(input, i, len)) {
      buf += c;
      i += 1;
      continue;
    }

    pushRun(runs, buf, italic, bold);
    buf = "";
    if (len >= 3) {
      italic = !italic;
      bold = !bold;
    } else if (len === 2) {
      bold = !bold;
    } else {
      italic = !italic;
    }
    i += len;
  }

  pushRun(runs, buf, italic, bold);
  return runs;
}

function pickShortTitle(title: string): string {
  const words = title
    .replace(/[^A-Za-z0-9\s'’-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const candidates = words.filter(
    (w) => !TITLE_STOPWORDS.has(w.toLowerCase()) && w.length > 2
  );
  const pool = candidates.length ? candidates : words;
  if (!pool.length) return "UNTITLED";
  return pool
    .reduce((longest, w) => (w.length > longest.length ? w : longest), pool[0])
    .toUpperCase();
}

export function parseStory(source: string, fallbackTitle: string): ParsedStory {
  const { frontmatter, body } = splitFrontmatter(source);
  const lines = stripVaultSyntax(body).split(/\r?\n/);

  let title: string | null = frontmatter["title"] ?? null;
  const blocks: Block[] = [];
  let pending: string[] = [];

  const flush = () => {
    if (!pending.length) return;
    const text = smartTypography(pending.join(" ").replace(/\s+/g, " ").trim());
    const runs = parseInline(text);
    if (runs.length) blocks.push({ kind: "para", runs });
    pending = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flush();
      continue;
    }

    if (SCENE_BREAK.test(line)) {
      flush();
      // Collapse repeats so a stray break before EOF doesn't double up.
      if (blocks[blocks.length - 1]?.kind !== "sceneBreak") {
        blocks.push({ kind: "sceneBreak" });
      }
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      flush();
      // The first heading is the story's title, not body text; later headings
      // are almost always part-dividers, so they become scene breaks.
      if (title === null) title = heading[1].trim();
      else if (blocks[blocks.length - 1]?.kind !== "sceneBreak") {
        blocks.push({ kind: "sceneBreak" });
      }
      continue;
    }

    pending.push(line);
  }
  flush();

  // A trailing scene break is an artifact of the source file, never intent.
  while (blocks.length && blocks[blocks.length - 1].kind === "sceneBreak") {
    blocks.pop();
  }

  const wordCount = blocks
    .filter((b): b is { kind: "para"; runs: Run[] } => b.kind === "para")
    .map((b) => b.runs.map((r) => r.text).join(""))
    .join(" ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;

  const resolvedTitle = title ?? fallbackTitle;

  return {
    title: resolvedTitle,
    shortTitle: frontmatter["shorttitle"] ?? pickShortTitle(resolvedTitle),
    frontmatter,
    blocks,
    wordCount,
  };
}

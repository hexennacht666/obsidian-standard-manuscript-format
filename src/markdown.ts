import { typographize } from "./typography";

/**
 * Shunn's format has no place for bold — emphasis is italic, or underline for
 * the markets still on the typewriter convention — so by default `**` is
 * consumed and discarded rather than carried to an emitter. A market that asks
 * for bold kept is the exception, and then it rides through as its own run.
 */
export interface Run {
  text: string;
  italic?: boolean;
  bold?: boolean;
}

export interface ParseOptions {
  /** Defaults to true, which is the format as Shunn wrote it. */
  stripBold?: boolean;
}

export type Block =
  | { kind: "para"; runs: Run[] }
  | { kind: "sceneBreak" };

export interface UnclosedQuote {
  /** 1-based position among body paragraphs. */
  paragraph: number;
  excerpt: string;
}

export interface ParsedStory {
  title: string | null;
  shortTitle: string | null;
  frontmatter: Record<string, string>;
  blocks: Block[];
  wordCount: number;
  /** From the story's own frontmatter — a fact about the story, not the market. */
  contentWarnings: string[];
  /**
   * Paragraphs that end mid-quote AND aren't continued by the next paragraph.
   * Deliberately not "every paragraph with an odd number of quotes" — speech
   * running over several paragraphs re-opens each one and closes only at the
   * end, so that check would fire on correctly written dialogue constantly.
   */
  unclosedQuotes: UnclosedQuote[];
}

const SCENE_BREAK = /^(#|\*(\s*\*){2,}|-{3,}|_{3,}|<hr\s*\/?>)$/;

const TITLE_STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "but",
  "with", "from", "by", "as", "is", "it", "its", "was", "were", "be", "been",
  "would", "should", "could", "will", "shall", "do", "does", "did", "that",
  "this", "these", "those", "all", "only",
]);

/**
 * Collapses a property name to a comparable form, so `Content warnings`,
 * `contentWarnings`, `content_warnings` and `CONTENT-WARNINGS` are one key.
 * Writers shouldn't have to remember which spelling they used.
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitFrontmatter(source: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const frontmatter: Record<string, string> = {};
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter, body: source };

  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, "");

  // A key with nothing after the colon opens a block list; its `- item` lines
  // are collected until the next key. Values stay strings, joined with commas,
  // so a list and a comma-separated line are interchangeable to callers.
  let listKey: string | null = null;

  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && listKey) {
      const value = clean(item[1]);
      frontmatter[listKey] = frontmatter[listKey]
        ? `${frontmatter[listKey]}, ${value}`
        : value;
      continue;
    }

    // Keys may contain spaces — "Content warnings" reads far better in
    // Obsidian's properties panel than contentWarnings, and YAML allows it.
    // Must start at column 0 with an alphanumeric so indented content can't be
    // mistaken for a key.
    const kv = line.match(/^([A-Za-z0-9][A-Za-z0-9_ -]*?)\s*:\s*(.*)$/);
    if (!kv) {
      listKey = null;
      continue;
    }
    const key = normalizeKey(kv[1]);
    frontmatter[key] = clean(kv[2]);
    listKey = frontmatter[key] === "" ? key : null;
  }

  return { frontmatter, body: source.slice(match[0].length) };
}

// Already normalized, so every spacing and casing variant of each is covered.
const CONTENT_WARNING_KEYS = [
  "contentwarnings",
  "contentwarning",
  "contentnotes",
  "contentnote",
  "cw",
];

function readContentWarnings(frontmatter: Record<string, string>): string[] {
  const key = CONTENT_WARNING_KEYS.find((k) => frontmatter[k]);
  if (!key) return [];
  return frontmatter[key]
    .replace(/^\[|\]$/g, "") // an inline [a, b] array
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
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
  const run: Run = { text, italic: italic || undefined };
  // Set only when there's bold to carry, so a run parsed with bold stripped is
  // exactly the run this produced before the setting existed.
  if (bold) run.bold = true;
  runs.push(run);
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

export function parseInline(input: string, options: ParseOptions = {}): Run[] {
  const stripBold = options.stripBold ?? true;
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
    // `*` is italic, `**` bold, `***` both. With bold stripped, `**` is
    // swallowed whole and changes nothing, and what survives `***` is italic.
    if (len !== 2) italic = !italic;
    if (len !== 1 && !stripBold) bold = !bold;
    i += len;
  }

  pushRun(runs, buf, italic, bold);
  return runs;
}

function pickShortTitle(title: string): string {
  // A subtitle is the wrong place to look for the running head's keyword —
  // "The Salt Year: A Fragment" should head as SALT, not FRAGMENT.
  const main = title.split(/\s*[:—–]\s*/)[0].trim() || title;

  const words = main
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

export function parseStory(
  source: string,
  fallbackTitle: string,
  options: ParseOptions = {}
): ParsedStory {
  const { frontmatter, body } = splitFrontmatter(source);
  const lines = stripVaultSyntax(body).split(/\r?\n/);

  // Blank is absent, not an override. A scaffold leaves these keys empty for
  // the writer to fill in later, and an empty title must fall back to the
  // heading or filename rather than producing an untitled manuscript.
  let title: string | null = frontmatter["title"]?.trim() || null;
  const blocks: Block[] = [];
  let pending: string[] = [];

  const paragraphs: { text: string; endsOpen: boolean }[] = [];

  const flush = () => {
    if (!pending.length) return;
    const { text, endsOpen } = typographize(
      pending.join(" ").replace(/\s+/g, " ").trim()
    );
    const runs = parseInline(text, options);
    if (runs.length) {
      blocks.push({ kind: "para", runs });
      paragraphs.push({ text, endsOpen });
    }
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

  // A paragraph left mid-quote is only suspect when the next one doesn't pick
  // the speech back up — that continuation is the convention, not an error.
  const unclosedQuotes: UnclosedQuote[] = [];
  paragraphs.forEach((para, i) => {
    if (!para.endsOpen) return;
    if (paragraphs[i + 1]?.text.trimStart().startsWith("“")) return;
    unclosedQuotes.push({
      paragraph: i + 1,
      excerpt: para.text.length > 60 ? `…${para.text.slice(-60)}` : para.text,
    });
  });

  const resolvedTitle = title ?? fallbackTitle;

  return {
    title: resolvedTitle,
    shortTitle:
      frontmatter["shorttitle"]?.trim() || pickShortTitle(resolvedTitle),
    frontmatter,
    blocks,
    wordCount,
    contentWarnings: readContentWarnings(frontmatter),
    unclosedQuotes,
  };
}

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
  | { kind: "sceneBreak" }
  /** A scene label: a heading after the title, printed centered; it is its own break. */
  | { kind: "sceneLabel"; runs: Run[] };

export interface UnclosedQuote {
  /** 1-based position among body paragraphs. */
  paragraph: number;
  excerpt: string;
}

export interface ParsedStory {
  title: string | null;
  shortTitle: string | null;
  /**
   * The story's opening heading as plain text, whether or not it was used as
   * the title. Obsidian's convention is that the first heading and the note's
   * name are the same thing, so this is what names the exported manuscript.
   */
  heading: string | null;
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
  // An empty block (`---` straight after `---`) and a leading byte-order mark
  // are both still frontmatter.
  const match = source.match(/^\uFEFF?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/);
  if (!match) return { frontmatter, body: source };

  // A quoted YAML scalar decodes its own escapes: '' inside single quotes,
  // \" and \\ inside double quotes.
  const clean = (s: string) => {
    const value = s.trim();
    const single = /^'([\s\S]*)'$/.exec(value);
    if (single) return single[1].replace(/''/g, "'");
    const double = /^"([\s\S]*)"$/.exec(value);
    if (double) return double[1].replace(/\\(["\\])/g, "$1");
    return value.replace(/^["']|["']$/g, "");
  };

  // A key with nothing after the colon opens a block list; its `- item` lines
  // are collected until the next key. Values stay strings, joined with commas,
  // so a list and a comma-separated line are interchangeable to callers.
  let listKey: string | null = null;

  for (const line of (match[1] ?? "").split(/\r?\n/)) {
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
export const CONTENT_WARNING_KEYS = [
  "contentwarnings",
  "contentwarning",
  "contentnotes",
  "contentnote",
  "cw",
];

function splitWarnings(value: string): string[] {
  return value
    .replace(/^\[|\]$/g, "") // an inline [a, b] array
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * The first accepted key that lists anything. An empty key is skipped rather
 * than read as "none": a scaffold's empty `Content warnings: []` can sit beside
 * the `Content notes` the writer actually filled in.
 */
function readContentWarnings(frontmatter: Record<string, string>): string[] {
  for (const key of CONTENT_WARNING_KEYS) {
    const warnings = splitWarnings(frontmatter[key] ?? "");
    if (warnings.length) return warnings;
  }
  return [];
}

/** Strip the Obsidian-isms that should never reach an editor's desk. */
function stripVaultSyntax(text: string): string {
  return text
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // An embed is a picture or another note, and a manuscript can hold neither.
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    // A link into a heading or block prints as the note it points at.
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) =>
      target.replace(/#.*$/, "") || target.replace(/^#\^?/, "")
    )
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Block IDs: ` ^id` at the end of a line, or alone on one.
    .replace(/(^|[ \t])\^[A-Za-z0-9-]+[ \t]*$/gm, "")
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

const WORD_CHAR = /[\p{L}\p{N}]/u;

const ESCAPABLE = /^[!-/:-@[-`{-~]$/;

/**
 * Whether a run of `*` or `_` can open or close emphasis. It opens after a
 * non-word character with text straight after it, and closes the other way
 * round, so snake_case, f*ck and 5 * 3 all print as written. Invented names in
 * speculative fiction are full of underscores.
 */
function flanking(text: string, i: number, len: number): { opens: boolean; closes: boolean } {
  const before = i > 0 ? text[i - 1] : " ";
  const after = i + len < text.length ? text[i + len] : " ";
  return {
    opens: !WORD_CHAR.test(before) && !/\s/.test(after),
    closes: !/\s/.test(before) && !WORD_CHAR.test(after),
  };
}

/** Whether a run of `marker` that can close emphasis appears from `from` on. */
function hasCloser(text: string, from: number, marker: string): boolean {
  for (let j = from; j < text.length; ) {
    if (text[j] === "\\" && ESCAPABLE.test(text[j + 1] ?? "")) {
      j += 2;
      continue;
    }
    if (text[j] !== marker) {
      j += 1;
      continue;
    }
    let len = 1;
    while (text[j + len] === marker) len++;
    if (flanking(text, j, len).closes) return true;
    j += len;
  }
  return false;
}

export function parseInline(input: string, options: ParseOptions = {}): Run[] {
  const stripBold = options.stripBold ?? true;
  const runs: Run[] = [];
  let buf = "";
  let italic = false;
  let strong = false;

  for (let i = 0; i < input.length; ) {
    const c = input[i];

    // Only ASCII punctuation can be escaped, as in Markdown, so a path like
    // C:\Users keeps its backslash.
    if (c === "\\" && ESCAPABLE.test(input[i + 1] ?? "")) {
      buf += input[i + 1];
      i += 2;
      continue;
    }

    if (c !== "*" && c !== "_") {
      buf += c;
      i += 1;
      continue;
    }

    const marker = input.slice(i).match(c === "*" ? /^\*{1,3}/ : /^_{1,3}/);
    const len = marker ? marker[0].length : 1;

    // An opener with no closer later in the paragraph is printed as written,
    // rather than emphasizing everything after it.
    const { opens, closes } = flanking(input, i, len);
    const closing = len === 2 ? strong : italic;
    const delimits = closing ? closes : opens && hasCloser(input, i + len, c);
    if (!delimits) {
      buf += input.slice(i, i + len);
      i += len;
      continue;
    }

    pushRun(runs, buf, italic, strong && !stripBold);
    buf = "";
    // `*` is italic, `**` bold, `***` both. With bold stripped, `**` is
    // swallowed whole and changes nothing, and what survives `***` is italic.
    if (len !== 2) italic = !italic;
    if (len !== 1) strong = !strong;
    i += len;
  }

  pushRun(runs, buf, italic, strong && !stripBold);
  return runs;
}

/**
 * Two keywords, in the order and the case the title uses.
 *
 * Shunn asks for "one or two keywords from the title of your story" and gives
 * no rule about capitals, so both halves of the old behaviour — one word, upper
 * case — were ours rather than the format's. A manuscript is passed between
 * readers who have to refer to it out loud, and "Perfumed Gloves" is a story
 * where "PERFUMED" is a word.
 *
 * Picked in title order rather than by length: the old rule chose the longest
 * word, which is why "Only Perfumed Gloves Would Do" headed as PERFUMED, and
 * length is not what makes a keyword recognisable.
 *
 * A story whose derived head is still wrong sets `Short title` in its own
 * frontmatter, as it always could.
 */
const MAX_KEYWORD_LENGTH = 24;

function pickShortTitle(title: string): string {
  // A subtitle is the wrong place to look for the running head's keyword —
  // "The Salt Year: A Fragment" should head as Salt Year, not Fragment.
  const main = title.split(/\s*[:—–]\s*/)[0].trim() || title;

  const words = main
    .replace(/[^A-Za-z0-9\s'’-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const candidates = words.filter(
    (w) => !TITLE_STOPWORDS.has(w.toLowerCase()) && w.length > 2
  );
  const pool = candidates.length ? candidates : words;
  if (!pool.length) return "Untitled";

  const [first, second] = pool;
  // One keyword when two would run long. Even the longest surname plus 24
  // characters plus a page number is half the width of a 6.5" line, so this is
  // about a head that reads quickly, not one that fits.
  const pair = second ? `${first} ${second}` : first;
  return pair.length <= MAX_KEYWORD_LENGTH ? pair : first;
}

/**
 * A title as it should print: quotes and dashes made typographic, emphasis
 * markers consumed. A title page, a document property and a file name have no
 * way to show italics, so the words are all that survive.
 */
export function plainTitle(raw: string): string {
  return parseInline(typographize(raw).text)
    .map((r) => r.text)
    .join("")
    .trim();
}

/** Loose match between a heading and a title: case, spacing and quote style vary. */
export function sameTitle(heading: string, title: string | null): boolean {
  if (!title) return false;
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  return norm(heading) === norm(title);
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
  let heading: string | null = null;
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

    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      flush();
      // The title heading is not body text: the first H1, or the first
      // heading of any level whose text is the note's own title (a stated
      // `Title`, or the filename). A note with no H1 takes its title from
      // the filename, and its first `## 1987` is a scene label, not the title.
      // Every other heading is a scene label: the label prints centered where
      // a # would go, and it is the break, so a marker directly before it is
      // redundant.
      const text = match[2].trim();
      const isTitle =
        heading === null &&
        (match[1].length === 1 ||
          sameTitle(text, title) ||
          sameTitle(text, fallbackTitle));
      if (isTitle) {
        heading = plainTitle(text);
        if (title === null) title = text;
        continue;
      }
      if (blocks[blocks.length - 1]?.kind === "sceneBreak") blocks.pop();
      const runs = parseInline(typographize(text).text, options);
      if (runs.length) blocks.push({ kind: "sceneLabel", runs });
      continue;
    }

    pending.push(line);
  }
  flush();

  // A break before the first paragraph or after the last is an artifact of
  // the source file, never intent.
  while (blocks.length && blocks[0].kind === "sceneBreak") blocks.shift();
  while (blocks.length && blocks[blocks.length - 1].kind !== "para") {
    blocks.pop();
  }

  // Scene labels count: a word processor counts them, and the "about N words"
  // line should agree with what the editor's own count says.
  const wordCount = blocks
    .filter(
      (b): b is { kind: "para" | "sceneLabel"; runs: Run[] } => b.kind !== "sceneBreak"
    )
    .map((b) => b.runs.map((r) => r.text).join(""))
    .join(" ")
    .split(/\s+/)
    .filter((w) => WORD_CHAR.test(w)).length;

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

  const resolvedTitle = title === null ? fallbackTitle : plainTitle(title);
  const statedShortTitle = frontmatter["shorttitle"]?.trim();

  return {
    title: resolvedTitle,
    shortTitle: statedShortTitle
      ? plainTitle(statedShortTitle)
      : pickShortTitle(resolvedTitle),
    heading,
    frontmatter,
    blocks,
    wordCount,
    contentWarnings: readContentWarnings(frontmatter),
    unclosedQuotes,
  };
}

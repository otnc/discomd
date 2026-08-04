import type { MarkdownElement } from "./types";
import type { TimestampStyle } from "./timestamp";

/**
 * Element kinds {@link parse} can tag a token with. A superset of
 * {@link MarkdownElement}: adds the Discord-specific tokens `strip`/`toHTML`
 * leave untouched (mentions, custom emoji, timestamps, slash commands),
 * `"boldItalic"` for the combined `***text***` marker (only removed/rendered
 * by `strip`/`toHTML` when both `"bold"` and `"italic"` are enabled), and
 * `"text"` for plain literal spans.
 */
export type ParsedElement =
  | MarkdownElement
  | "boldItalic"
  | "timestamp"
  | "mention"
  | "roleMention"
  | "channelMention"
  | "emoji"
  | "slashCommand"
  | "text";

const MARKDOWN_ELEMENTS = new Set<MarkdownElement>([
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "spoiler",
  "code",
  "codeBlock",
  "blockQuote",
  "header",
  "subtext",
  "list",
  "link",
  "embedLink",
  "silent",
]);

/** Whether `element` is one of {@link MarkdownElement} (i.e. a `disable`-able kind), as opposed to a parse-only kind (`"text"`, `"boldItalic"`, mentions, etc.). */
export function isMarkdownElement(
  element: ParsedElement
): element is MarkdownElement {
  return MARKDOWN_ELEMENTS.has(element as MarkdownElement);
}

/**
 * Elements whose `content` can itself contain further markdown (e.g. italic
 * nested inside bold) — `parse` only tags the outermost construct, so
 * `strip`/`toHTML` resolve these by recursing over the token's content.
 * Excludes verbatim content (`code`, `codeBlock`) and leaf values
 * (`embedLink`, `silent`).
 */
export const NESTABLE_ELEMENTS = new Set<MarkdownElement>([
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "spoiler",
  "blockQuote",
  "header",
  "subtext",
  "list",
  "link",
]);

/**
 * A span of the original text tagged with what it is. Tokens partition the
 * input exactly: sorted by `start`, contiguous, no gaps or overlaps.
 */
export interface Token {
  element: ParsedElement;
  /** Inclusive start index into the original text. */
  start: number;
  /** Exclusive end index into the original text. */
  end: number;
  /** The exact original substring, markup included (e.g. `"**bold**"`). */
  raw: string;
  /**
   * The substring with its markup peeled off and any backslash-escaped
   * markdown characters (`\*`) resolved to their literal form (e.g.
   * `"bold"`, or `"*literal*"` from the escaped input `"\*literal\*"`).
   */
  content: string;
  /** Header level 1-3. Only set for `"header"` tokens. */
  level?: number;
  /** Whether a list item uses a number (`1.`) rather than a bullet. Only set for `"list"` tokens. */
  ordered?: boolean;
  /** The fenced code block's language tag, if any. Only set for `"codeBlock"` tokens. */
  lang?: string;
  /** The link target. Only set for `"link"`/`"embedLink"` tokens. */
  url?: string;
  /** Unix epoch seconds. Only set for `"timestamp"` tokens. */
  epoch?: number;
  /** Display style (`t`/`T`/`d`/`D`/`f`/`F`/`R`). Only set for `"timestamp"` tokens. */
  style?: TimestampStyle;
}

// Each alternative is tried in order at a given position; JS regex
// alternation takes the first one that matches, so more specific/anchored
// patterns are listed first where two could otherwise both start at the
// same index. Lookaround-guarded widths (bold vs. italic vs. boldItalic,
// code vs. code block) prevent an enabled style from partially matching a
// disabled sibling's markers (see strip.ts) and make truly ambiguous runs
// (e.g. four asterisks) fall through as plain text instead of being
// mis-tagged.
//
// Inline patterns also guard against a preceding backslash so Discord's
// `\*escaped\*` syntax falls through as plain text. Line-anchored patterns
// (block quote, header, subtext, list) need no such guard: `^` requires the
// marker to be the line's literal first character, which a leading
// backslash already rules out.
const TOKEN_PATTERN = new RegExp(
  [
    /(?<!\\)```(?:[^\n`]*\n)?[\s\S]*?```/, // codeBlock
    /(?<!\\)(?<!`)`(?!`)[^`\n]+?(?<!`)`(?!`)/, // code
    /^>>>[ \t]?[\s\S]*/, // blockQuote (multiline, takes the rest of the message)
    /^>[ \t]?.*/, // blockQuote (single line)
    /^-#[ \t]+.*/, // subtext
    /^#{1,3}[ \t]+.*/, // header
    /^[ \t]*(?:[*\-+]|\d+\.)[ \t]+.*/, // list
    /(?<!\\)~~.+?~~/, // strikethrough
    /(?<!\\)\|\|.+?\|\|/, // spoiler
    /(?<!\\)(?<!\*)\*\*\*(?!\*).+?(?<!\*)\*\*\*(?!\*)/, // boldItalic
    /(?<!\\)(?<!_)__(?!_).+?(?<!_)__(?!_)/, // underline
    /(?<!\\)(?<!\*)\*\*(?!\*).+?(?<!\*)\*\*(?!\*)/, // bold
    /(?<!\\)(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/, // italic (asterisk)
    /(?<!\\)(?<!_)_(?!_).+?(?<!_)_(?!_)/, // italic (underscore)
    /(?<!\\)\[[^\]]*\]\([^)\s]+\)/, // link
    /(?<!\\)<https?:\/\/[^\s<>]+>/, // embedLink
    /(?<!\\)<t:-?\d+(?::[tTdDfFR])?>/, // timestamp
    /(?<!\\)<@&\d+>/, // roleMention
    /(?<!\\)<@!?\d+>/, // mention
    /(?<!\\)<#\d+>/, // channelMention
    /(?<!\\)<a?:[^:<>]+:\d+>/, // emoji
    /(?<!\\)<\/[^<>]+:\d+>/, // slashCommand
  ]
    .map((r) => r.source)
    .join("|"),
  "gm"
);

// Characters Discord lets you backslash-escape to suppress their markdown
// meaning; resolved to their literal form in every `content` field (never
// in `raw`, which always preserves the exact original substring).
const UNESCAPE_PATTERN = /\\([\\*_~`>#|[\]()-])/g;

function unescapeText(s: string): string {
  return s.replace(UNESCAPE_PATTERN, "$1");
}

function stripEnds(raw: string, startLen: number, endLen: number): string {
  return unescapeText(raw.slice(startLen, raw.length - endLen));
}

function tokenFor(raw: string, start: number): Token {
  const end = start + raw.length;
  const base = { start, end, raw };

  if (raw.startsWith("```")) {
    const match = /^```(?:([^\n`]*)\n)?([\s\S]*?)```$/.exec(raw)!;
    return {
      ...base,
      element: "codeBlock",
      lang: match[1] || undefined,
      content: unescapeText(match[2]),
    };
  }
  if (raw.startsWith("`")) {
    return { ...base, element: "code", content: stripEnds(raw, 1, 1) };
  }
  if (/^>>>[ \t]?/.test(raw)) {
    return {
      ...base,
      element: "blockQuote",
      content: unescapeText(raw.replace(/^>>>[ \t]?/, "")),
    };
  }
  if (raw.startsWith(">")) {
    return {
      ...base,
      element: "blockQuote",
      content: unescapeText(raw.replace(/^>[ \t]?/, "")),
    };
  }
  if (raw.startsWith("-#")) {
    return {
      ...base,
      element: "subtext",
      content: unescapeText(raw.replace(/^-#[ \t]+/, "")),
    };
  }
  if (/^#{1,3}[ \t]/.test(raw)) {
    const hashes = /^#{1,3}/.exec(raw)![0];
    return {
      ...base,
      element: "header",
      level: hashes.length,
      content: unescapeText(raw.replace(/^#{1,3}[ \t]+/, "")),
    };
  }
  if (/^[ \t]*(?:[*\-+]|\d+\.)[ \t]+/.test(raw)) {
    return {
      ...base,
      element: "list",
      ordered: /^[ \t]*\d+\./.test(raw),
      content: unescapeText(raw.replace(/^[ \t]*(?:[*\-+]|\d+\.)[ \t]+/, "")),
    };
  }
  if (raw.startsWith("~~")) {
    return { ...base, element: "strikethrough", content: stripEnds(raw, 2, 2) };
  }
  if (raw.startsWith("||")) {
    return { ...base, element: "spoiler", content: stripEnds(raw, 2, 2) };
  }
  if (raw.startsWith("***")) {
    return { ...base, element: "boldItalic", content: stripEnds(raw, 3, 3) };
  }
  if (raw.startsWith("__")) {
    return { ...base, element: "underline", content: stripEnds(raw, 2, 2) };
  }
  if (raw.startsWith("**")) {
    return { ...base, element: "bold", content: stripEnds(raw, 2, 2) };
  }
  if (raw.startsWith("*") || raw.startsWith("_")) {
    return { ...base, element: "italic", content: stripEnds(raw, 1, 1) };
  }
  if (raw.startsWith("[")) {
    const match = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(raw)!;
    return {
      ...base,
      element: "link",
      content: unescapeText(match[1]),
      url: unescapeText(match[2]),
    };
  }
  if (/^<https?:\/\//.test(raw)) {
    const url = unescapeText(stripEnds(raw, 1, 1));
    return { ...base, element: "embedLink", content: url, url };
  }
  if (raw.startsWith("<t:")) {
    const match = /^<t:(-?\d+)(?::([tTdDfFR]))?>$/.exec(raw)!;
    return {
      ...base,
      element: "timestamp",
      content: match[1],
      epoch: Number(match[1]),
      style: (match[2] as TimestampStyle | undefined) ?? "f",
    };
  }
  if (raw.startsWith("<@&")) {
    return { ...base, element: "roleMention", content: stripEnds(raw, 1, 1) };
  }
  if (raw.startsWith("<@")) {
    return { ...base, element: "mention", content: stripEnds(raw, 1, 1) };
  }
  if (raw.startsWith("<#")) {
    return {
      ...base,
      element: "channelMention",
      content: stripEnds(raw, 1, 1),
    };
  }
  if (raw.startsWith("</")) {
    return {
      ...base,
      element: "slashCommand",
      content: stripEnds(raw, 2, 1),
    };
  }
  // Only <a:name:id>/<:name:id> is left.
  return { ...base, element: "emoji", content: stripEnds(raw, 1, 1) };
}

/**
 * Tokenize Discord Markdown text without removing or rendering anything.
 * The single source of truth for recognizing Discord Markdown — both
 * {@link strip} and {@link toHTML} are built on top of this.
 *
 * Returns a flat, non-overlapping list of tokens covering the entire input
 * (plain-text spans are tagged `"text"`), each with its position in the
 * original string. Deeply nested markup (e.g. emphasis nested inside a
 * code span) is not decomposed further — each token describes only its
 * outermost construct, consistent with the regex-based (not full
 * CommonMark) approach.
 *
 * A leading `@silent` marker is tagged as its own `"silent"` token.
 * Mentions, custom emoji, timestamps and slash command mentions are tagged
 * with their own element (not left as inert `"text"`), so callers can
 * resolve/format them — e.g. pass a `"timestamp"` token's `epoch`/`style`
 * to {@link formatTimestamp}.
 */
export function parse(text: string): Token[] {
  const input = text ?? "";
  const tokens: Token[] = [];

  let offset = 0;
  let body = input;

  const silent = body.match(/^@silent\s+/i);
  if (silent) {
    tokens.push({
      element: "silent",
      start: 0,
      end: silent[0].length,
      raw: silent[0],
      content: "",
    });
    offset = silent[0].length;
    body = body.slice(offset);
  }

  let cursor = 0;
  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const index = match.index;
    if (index > cursor) {
      const gap = body.slice(cursor, index);
      tokens.push({
        element: "text",
        start: offset + cursor,
        end: offset + index,
        raw: gap,
        content: unescapeText(gap),
      });
    }
    tokens.push(tokenFor(match[0], offset + index));
    cursor = index + match[0].length;
  }
  if (cursor < body.length) {
    const gap = body.slice(cursor);
    tokens.push({
      element: "text",
      start: offset + cursor,
      end: offset + body.length,
      raw: gap,
      content: unescapeText(gap),
    });
  }

  return tokens;
}

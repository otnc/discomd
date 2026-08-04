import escapeHtml from "escape-html";
import type { MarkdownElement } from "./types";
import {
  isMarkdownElement,
  NESTABLE_ELEMENTS,
  nestedOptions,
  parse,
} from "./parse";
import type { ParsedElement, Token } from "./parse";

/**
 * Options for {@link toHTML}.
 */
export interface ToHTMLOptions {
  /**
   * Elements to leave as literal (HTML-escaped) text instead of rendering.
   * Default: `[]` (every element is rendered).
   */
  disable?: MarkdownElement[];
}

const HTTP_URL_PATTERN = /^https?:\/\//;

function nested(
  element: ParsedElement,
  content: string,
  options: ToHTMLOptions
): string {
  return toHTML(content, nestedOptions(element, options));
}

function renderLink(token: Token, label: string): string {
  if (!token.url || !HTTP_URL_PATTERN.test(token.url)) {
    return escapeHtml(token.raw);
  }
  return `<a href="${escapeHtml(token.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderToken(
  token: Token,
  options: ToHTMLOptions,
  isEnabled: (element: MarkdownElement) => boolean
): string {
  if (token.element === "text") return escapeHtml(token.content);

  if (token.element === "boldItalic") {
    if (!isEnabled("bold") || !isEnabled("italic"))
      return escapeHtml(token.raw);
    return `<strong><em>${nested(token.element, token.content, options)}</em></strong>`;
  }

  if (!isMarkdownElement(token.element) || !isEnabled(token.element)) {
    return escapeHtml(token.raw);
  }

  const inner = () =>
    NESTABLE_ELEMENTS.has(token.element as MarkdownElement)
      ? nested(token.element, token.content, options)
      : escapeHtml(token.content);

  switch (token.element) {
    case "bold":
      return `<strong>${inner()}</strong>`;
    case "italic":
      return `<em>${inner()}</em>`;
    case "underline":
      return `<u>${inner()}</u>`;
    case "strikethrough":
      return `<s>${inner()}</s>`;
    case "spoiler":
      return `<span class="spoiler">${inner()}</span>`;
    case "code":
      return `<code>${inner()}</code>`;
    case "codeBlock": {
      const cls = token.lang
        ? ` class="language-${escapeHtml(token.lang)}"`
        : "";
      return `<pre><code${cls}>${escapeHtml(token.content)}</code></pre>`;
    }
    case "header":
      return `<h${token.level}>${inner()}</h${token.level}>`;
    case "subtext":
      return `<span class="subtext">${inner()}</span>`;
    case "link":
      return renderLink(token, inner());
    case "embedLink":
      return renderLink(token, escapeHtml(token.content));
    case "silent":
      return "";
    // "list"/"blockQuote" are always consumed as a run by toHTML's main
    // loop before reaching here (see collectRun) when enabled, and handled
    // by the generic disabled-passthrough above otherwise.
    default:
      return escapeHtml(token.raw);
  }
}

// Groups a run of consecutive same-element tokens, separated only by a
// single bare newline, so e.g. three `list` lines in a row become one
// `<ul>` instead of three. A lone token (no neighbors to merge with) is
// just a run of length one.
function collectRun(
  tokens: Token[],
  start: number,
  element: MarkdownElement
): { items: Token[]; next: number } {
  const items = [tokens[start]];
  let i = start + 1;
  while (
    i + 1 < tokens.length &&
    tokens[i].element === "text" &&
    tokens[i].raw === "\n" &&
    tokens[i + 1].element === element
  ) {
    items.push(tokens[i + 1]);
    i += 2;
  }
  return { items, next: i };
}

function renderList(items: Token[], options: ToHTMLOptions): string {
  const tag = items[0].ordered ? "ol" : "ul";
  const li = items.map(
    (item) => `<li>${nested("list", item.content, options)}</li>`
  );
  return `<${tag}>${li.join("")}</${tag}>`;
}

function renderBlockQuote(items: Token[], options: ToHTMLOptions): string {
  // `.replace(/\n/g, "<br>")` also covers a >>> quote's own internal line
  // breaks (that variant is always a single-item run: it already spans the
  // rest of the message, so there's no adjacent `blockQuote` token to merge
  // with above).
  return `<blockquote>${items
    .map((item) => nested("blockQuote", item.content, options))
    .join("<br>")
    .replace(/\n/g, "<br>")}</blockquote>`;
}

/**
 * Render Discord Markdown to an HTML string.
 *
 * Built on {@link parse}: all text is HTML-escaped per-segment (via
 * `escape-html`), so the result is safe to insert into a page as-is; only
 * the tags this function generates itself are ever emitted as raw markup.
 * Masked links and suppressed embed links are only turned into `<a>` tags
 * when their URL is `http(s)`; anything else is left as literal escaped
 * text.
 *
 * Covers the same syntax as {@link strip} (bold, italic, underline,
 * strikethrough, spoilers, code/code blocks, block quotes, headers,
 * subtext, lists, masked links, suppressed embed links, `@silent`), mapped
 * to `<strong>`, `<em>`, `<u>`, `<s>`, `<span class="spoiler">`, `<code>`,
 * `<pre><code>`, `<blockquote>`, `<h1>`-`<h3>`, `<span class="subtext">`,
 * `<ul>`/`<ol>` and `<a>` respectively.
 *
 * Mentions, custom emoji and timestamps are left as literal text, same as
 * {@link strip}. Line breaks are preserved as-is (not converted to `<br>`,
 * except to join lines within a single block quote); render the result
 * with `white-space: pre-wrap` or convert newlines yourself.
 *
 * Every element in {@link MarkdownElement} is rendered by default; pass
 * its name in `options.disable` to leave it as literal text instead.
 */
export function toHTML(text: string, options: ToHTMLOptions = {}): string {
  const disabled = new Set(options.disable ?? []);
  const isEnabled = (element: MarkdownElement) => !disabled.has(element);

  const tokens = parse(text ?? "");
  const pieces: string[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.element === "list" && isEnabled("list")) {
      const run = collectRun(tokens, i, "list");
      pieces.push(renderList(run.items, options));
      i = run.next;
      continue;
    }

    if (token.element === "blockQuote" && isEnabled("blockQuote")) {
      const run = collectRun(tokens, i, "blockQuote");
      pieces.push(renderBlockQuote(run.items, options));
      i = run.next;
      continue;
    }

    pieces.push(renderToken(token, options, isEnabled));
    i += 1;
  }

  return pieces.join("");
}

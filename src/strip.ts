import type { MarkdownElement } from "./types";
import {
  isMarkdownElement,
  NESTABLE_ELEMENTS,
  nestedOptions,
  parse,
} from "./parse";
import type { Token } from "./parse";

/**
 * Options for {@link strip}.
 */
export interface StripOptions {
  /**
   * Elements to leave untouched instead of removing. Default: `[]` (every
   * element is removed).
   */
  disable?: MarkdownElement[];
}

function resolve(
  token: Token,
  options: StripOptions,
  isEnabled: (element: MarkdownElement) => boolean
): string {
  if (token.element === "text") return token.content;

  if (token.element === "boldItalic") {
    if (!isEnabled("bold") || !isEnabled("italic")) return token.raw;
    return strip(token.content, nestedOptions(token.element, options));
  }

  if (isMarkdownElement(token.element)) {
    if (!isEnabled(token.element)) return token.raw;
    return NESTABLE_ELEMENTS.has(token.element)
      ? strip(token.content, nestedOptions(token.element, options))
      : token.content;
  }

  // Mentions, custom emoji, timestamps, slash commands: always left as-is.
  return token.raw;
}

/**
 * Strip Discord Markdown formatting from text, leaving plain text behind.
 *
 * Built on {@link parse}: covers the syntax described in Discord's Markdown
 * 101 article (bold, italic, underline, strikethrough, spoilers, code/code
 * blocks, block quotes, headers, subtext, lists, masked links) plus
 * suppressed embed links (`<https://example.com>`) and a leading `@silent`
 * marker.
 *
 * Mentions (`<@id>`, `<@&id>`, `<@$id>`, `<#id>`, `</command:id>`), custom emoji
 * (`<:name:id>`, `<a:name:id>`) and timestamps (`<t:unix:style>`) are left
 * untouched, since their raw IDs carry no displayable information on their
 * own.
 *
 * Every element in {@link MarkdownElement} is removed by default; pass its
 * name in `options.disable` to leave it untouched instead.
 */
export function strip(text: string, options: StripOptions = {}): string {
  const disabled = new Set(options.disable ?? []);
  const isEnabled = (element: MarkdownElement) => !disabled.has(element);

  const output = parse(text ?? "")
    .map((token) => resolve(token, options, isEnabled))
    .join("");

  // Collapse blank lines left behind by removed block markup.
  return output.replace(/\n{3,}/g, "\n\n");
}

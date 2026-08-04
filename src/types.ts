/**
 * Discord Markdown elements {@link strip} and {@link toHTML} can act on.
 * All are removed/rendered by default; shared across the package so element
 * names stay consistent between the plain-text stripper and the HTML
 * renderer.
 */
export type MarkdownElement =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "spoiler"
  | "code"
  | "codeBlock"
  | "blockQuote"
  | "header"
  | "subtext"
  | "list"
  | "link"
  | "embedLink"
  | "silent";

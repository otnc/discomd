# discomd

Some useful features for Discord Markdown

[![npm](https://img.shields.io/npm/v/discomd)](https://www.npmjs.com/package/discomd)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/otnc/discomd/ci.yml?branch=main)](https://github.com/otnc/discomd/actions)
[![GitHub](https://img.shields.io/github/license/otnc/discomd)](https://github.com/otnc/discomd/blob/main/LICENSE)
[![Node](https://img.shields.io/node/v/discomd)](https://www.npmjs.com/package/discomd)

## Install

```sh
npm install discomd
```

## Usage

```ts
import { strip, toHTML, parse, formatTimestamp } from "discomd";

strip("**bold** and *italic* and ~~gone~~");
// -> "bold and italic and gone"

strip("> quoted\n[Discord](https://discord.com)");
// -> "quoted\nDiscord"

toHTML("**bold** and *italic* and ~~gone~~");
// -> "<strong>bold</strong> and <em>italic</em> and <s>gone</s>"

parse("**bold** text");
// -> [
//      { element: "bold", start: 0, end: 8, raw: "**bold**", content: "bold" },
//      { element: "text", start: 8, end: 13, raw: " text", content: " text" },
//    ]

formatTimestamp(1700000000, "R", { locale: "en-US" });
// -> e.g. "2 years ago" -- relative to now, so this drifts over time
```

### Options

`strip` and `toHTML` take the same shape of options:

```ts
strip(text, {
  disable: [], // element names to leave untouched instead of removing, see below
});

toHTML(text, {
  disable: [], // element names to leave as literal (HTML-escaped) text instead of rendering
});
```

`disable` takes any of: `"bold"`, `"italic"`, `"underline"`, `"strikethrough"`,
`"spoiler"`, `"code"`, `"codeBlock"`, `"blockQuote"`, `"header"`, `"subtext"`,
`"list"`, `"link"`, `"embedLink"`, `"silent"`. Every element is
removed/rendered by default.

```ts
strip("**bold** ||secret||", { disable: ["spoiler"] });
// -> "bold ||secret||"

toHTML("**bold** ||secret||", { disable: ["spoiler"] });
// -> "<strong>bold</strong> ||secret||"
```

## Requirements

- Node.js >= 22

## Features

Both `strip` and `toHTML` cover the syntax described in Discord's [Markdown 101](https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline) article:

- Bold, italic, bold+italic, underline, strikethrough, spoilers
- Inline code and fenced code blocks
- Single-line (`>`) and multiline (`>>>`) block quotes
- Headers (`#`, `##`, `###`) and subtext (`-#`)
- List leaders (`-`, `*`, `+`, `1.`)
- Masked links (`[title](url)`)
- Backslash-escaped markdown characters (`\*`)

Plus Discord-specific tokens:

- Suppressed embed links (`<https://example.com>`)
- A leading `@silent` marker — only recognized as the first thing in the message

Mentions (`<@id>`, `<@!id>`, `<@&id>`, `<@$id>`, `<#id>`), custom emoji (`<:name:id>`, `<a:name:id>`) and timestamps (`<t:unix:style>`) are left as-is (untouched by `strip`, literal escaped text from `toHTML`), since their raw IDs carry no displayable information on their own.

### `strip`

Strips all of the above, leaving plain text behind.

### `toHTML`

Renders the same syntax to HTML: `<strong>`, `<em>`, `<u>`, `<s>`,
`<span class="spoiler">`, `<code>`, `<pre><code>` (with a `language-xxx`
class when a fenced code block specifies one), `<blockquote>`, `<h1>`-`<h3>`,
`<span class="subtext">`, `<ul>`/`<ol>` and `<a>`.

All text is HTML-escaped up front (via [`escape-html`](https://www.npmjs.com/package/escape-html)), so the result is safe to insert into a page as-is — only the tags `toHTML` generates itself are ever emitted as raw markup. Masked links and suppressed embed links are only turned into `<a>` tags when their URL is `http(s)`; anything else is left as literal escaped text.

Line breaks are preserved as-is (not converted to `<br>`, except to join lines within a single block quote) — render the result with `white-space: pre-wrap`, or convert newlines yourself.

### `parse`

Tokenizes Discord Markdown without removing or rendering anything: `parse(text)` returns a flat, non-overlapping list of tokens (`{ element, start, end, raw, content, ... }`) covering the entire input — plain-text spans are tagged `"text"`. It doesn't take a `disable` option; it always describes everything it recognizes.

`element` is a superset of the names `disable` accepts: it also tags `"timestamp"`, `"mention"`, `"globalMention"` (`<@!id>`), `"roleMention"`, `"gameMention"` (`<@$id>`), `"channelMention"`, `"emoji"`, `"slashCommand"` and `"boldItalic"` (for `***text***`) — tokens `strip`/`toHTML` otherwise leave untouched or treat specially — so you can resolve or render them yourself, e.g. pass a `"timestamp"` token's `epoch`/`style` to `formatTimestamp`.

`strip` and `toHTML` are both built on `parse`: each token's `content` is resolved (recursively, for elements whose content can itself hold further markdown, like bold containing italic) and either kept or reverted to `raw` depending on `disable`. `parse` itself only ever describes the outermost construct at a given position — it doesn't recurse — consistent with the regex-based (not full CommonMark) approach.

### `formatTimestamp`

Discord timestamps (`<t:unix:style>`) are intentionally **not** handled by `strip`/`toHTML`/`parse`'s removal or rendering — only extracted as data by `parse`. Formatting them (locale, explicit style override, etc.) is its own concern:

```ts
formatTimestamp(1700000000, "F", { locale: "ja-JP" });
```

`style` (`t`/`T`/`d`/`D`/`f`/`F`/`R`) defaults to `"f"`, matching Discord's own default when a message omits it. `"R"` renders a relative time (e.g. `"3 years ago"`); the rest render an absolute date/time via `Intl.DateTimeFormat`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

Distributed under the [MIT License](./LICENSE).

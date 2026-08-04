import { describe, expect, it } from "vitest";
import { parse } from "./parse";
import type { Token } from "./parse";

// Every token's start/end must line up exactly with `raw` inside the
// original text, and tokens must partition the input with no gaps/overlaps.
function assertPartition(text: string, tokens: Token[]) {
  let cursor = 0;
  for (const token of tokens) {
    expect(token.start).toBe(cursor);
    expect(text.slice(token.start, token.end)).toBe(token.raw);
    cursor = token.end;
  }
  expect(cursor).toBe(text.length);
}

describe("parse", () => {
  it("returns an empty array for empty input", () => {
    expect(parse("")).toEqual([]);
  });

  it("tags a plain string as a single text token", () => {
    const tokens = parse("just plain text");
    assertPartition("just plain text", tokens);
    expect(tokens).toEqual([
      {
        element: "text",
        start: 0,
        end: 15,
        raw: "just plain text",
        content: "just plain text",
      },
    ]);
  });

  it("tags bold, italic, underline, strikethrough and spoiler", () => {
    const text = "a **bold** b *italic* c __under__ d ~~gone~~ e ||hidden||";
    const tokens = parse(text);
    assertPartition(text, tokens);
    const byElement = Object.fromEntries(
      tokens.filter((t) => t.element !== "text").map((t) => [t.element, t])
    );
    expect(byElement.bold).toMatchObject({ raw: "**bold**", content: "bold" });
    expect(byElement.italic).toMatchObject({
      raw: "*italic*",
      content: "italic",
    });
    expect(byElement.underline).toMatchObject({
      raw: "__under__",
      content: "under",
    });
    expect(byElement.strikethrough).toMatchObject({
      raw: "~~gone~~",
      content: "gone",
    });
    expect(byElement.spoiler).toMatchObject({
      raw: "||hidden||",
      content: "hidden",
    });
  });

  it("tags a ***text*** run as its own boldItalic token", () => {
    const tokens = parse("***text***");
    assertPartition("***text***", tokens);
    expect(tokens).toEqual([
      {
        element: "boldItalic",
        start: 0,
        end: 10,
        raw: "***text***",
        content: "text",
      },
    ]);
  });

  it("tags inline code and fenced code blocks, with the language when given", () => {
    const tokens = parse("`code` and ```js\nconst a = 1;\n``` and ```plain```");
    assertPartition(
      "`code` and ```js\nconst a = 1;\n``` and ```plain```",
      tokens
    );
    const code = tokens.find((t) => t.element === "code")!;
    expect(code).toMatchObject({ raw: "`code`", content: "code" });
    const codeBlocks = tokens.filter((t) => t.element === "codeBlock");
    expect(codeBlocks[0]).toMatchObject({
      lang: "js",
      content: "const a = 1;",
    });
    expect(codeBlocks[1]).toMatchObject({ lang: undefined, content: "plain" });
  });

  it("tags a single-line block quote", () => {
    const tokens = parse("> quoted");
    assertPartition("> quoted", tokens);
    expect(tokens).toEqual([
      {
        element: "blockQuote",
        start: 0,
        end: 8,
        raw: "> quoted",
        content: "quoted",
      },
    ]);
  });

  it("tags each line of consecutive single-line block quotes separately", () => {
    const text = "> one\n> two";
    const tokens = parse(text);
    assertPartition(text, tokens);
    const quotes = tokens.filter((t) => t.element === "blockQuote");
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toMatchObject({ content: "one" });
    expect(quotes[1]).toMatchObject({ content: "two" });
  });

  it("tags a multiline >>> block quote as one token spanning the rest of the message", () => {
    const text = ">>> one\ntwo";
    const tokens = parse(text);
    assertPartition(text, tokens);
    expect(tokens).toEqual([
      {
        element: "blockQuote",
        start: 0,
        end: text.length,
        raw: text,
        content: "one\ntwo",
      },
    ]);
  });

  it("tags headers with their level", () => {
    const tokens = parse("# H1\n## H2\n### H3");
    assertPartition("# H1\n## H2\n### H3", tokens);
    const headers = tokens.filter((t) => t.element === "header");
    expect(headers.map((h) => [h.level, h.content])).toEqual([
      [1, "H1"],
      [2, "H2"],
      [3, "H3"],
    ]);
  });

  it("tags subtext", () => {
    const tokens = parse("-# small");
    assertPartition("-# small", tokens);
    expect(tokens[0]).toMatchObject({ element: "subtext", content: "small" });
  });

  it("tags list items with ordered/unordered", () => {
    const text = "- bullet\n1. numbered";
    const tokens = parse(text);
    assertPartition(text, tokens);
    const items = tokens.filter((t) => t.element === "list");
    expect(items).toEqual([
      expect.objectContaining({ ordered: false, content: "bullet" }),
      expect.objectContaining({ ordered: true, content: "numbered" }),
    ]);
  });

  it("tags masked links with title and url", () => {
    const tokens = parse("[Discord](https://discord.com)");
    assertPartition("[Discord](https://discord.com)", tokens);
    expect(tokens[0]).toMatchObject({
      element: "link",
      content: "Discord",
      url: "https://discord.com",
    });
  });

  it("tags suppressed embed links", () => {
    const tokens = parse("<https://discord.com>");
    assertPartition("<https://discord.com>", tokens);
    expect(tokens[0]).toMatchObject({
      element: "embedLink",
      content: "https://discord.com",
      url: "https://discord.com",
    });
  });

  it("tags timestamps with epoch and style", () => {
    const tokens = parse("<t:1700000000:R>");
    assertPartition("<t:1700000000:R>", tokens);
    expect(tokens[0]).toMatchObject({
      element: "timestamp",
      epoch: 1700000000,
      style: "R",
    });
  });

  it("defaults timestamp style to f when omitted", () => {
    const tokens = parse("<t:1700000000>");
    expect(tokens[0]).toMatchObject({ element: "timestamp", style: "f" });
  });

  it("tags mentions, role mentions, channel mentions, emoji and slash commands", () => {
    const text =
      "<@123> <@!123> <@&123> <#123> <:pog:123> <a:pog:123> </cmd:123>";
    const tokens = parse(text);
    assertPartition(text, tokens);
    const elements = tokens
      .filter((t) => t.element !== "text")
      .map((t) => t.element);
    expect(elements).toEqual([
      "mention",
      "mention",
      "roleMention",
      "channelMention",
      "emoji",
      "emoji",
      "slashCommand",
    ]);
  });

  it("tags a leading @silent marker as its own token", () => {
    const text = "@silent <@123> hi";
    const tokens = parse(text);
    assertPartition(text, tokens);
    expect(tokens[0]).toMatchObject({
      element: "silent",
      start: 0,
      end: 8,
      raw: "@silent ",
    });
    expect(tokens[1]).toMatchObject({ element: "mention" });
  });

  it("does not treat a mid-message @silent as special", () => {
    const tokens = parse("hi @silent there");
    assertPartition("hi @silent there", tokens);
    expect(tokens.every((t) => t.element === "text")).toBe(true);
  });

  it("leaves escaped markdown unrecognized, resolving the escape in content", () => {
    const text = "\\*not bold\\*";
    const tokens = parse(text);
    assertPartition(text, tokens);
    // Escaped markers aren't recognized as markdown, so the whole thing is
    // one text token; content resolves the escape, raw keeps the backslash.
    expect(tokens).toEqual([
      {
        element: "text",
        start: 0,
        end: text.length,
        raw: text,
        content: "*not bold*",
      },
    ]);
  });

  it("partitions a realistic mixed message with no gaps or overlaps", () => {
    const input = [
      "# Announcement",
      "**Server maintenance** is scheduled for <t:1700000000:F>.",
      "> Please save your work.",
      "- Step one",
      "- Step two",
      "Ping <@123456789012345678> for questions. ||this part is secret||",
    ].join("\n");

    const tokens = parse(input);
    assertPartition(input, tokens);

    expect(tokens.some((t) => t.element === "header" && t.level === 1)).toBe(
      true
    );
    expect(tokens.some((t) => t.element === "bold")).toBe(true);
    expect(tokens.some((t) => t.element === "timestamp")).toBe(true);
    expect(tokens.some((t) => t.element === "blockQuote")).toBe(true);
    expect(tokens.filter((t) => t.element === "list")).toHaveLength(2);
    expect(tokens.some((t) => t.element === "mention")).toBe(true);
    expect(tokens.some((t) => t.element === "spoiler")).toBe(true);
  });
});

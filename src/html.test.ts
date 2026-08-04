import { describe, expect, it } from "vitest";
import { toHTML } from "./html";

describe("toHTML", () => {
  it("returns an empty string for empty input", () => {
    expect(toHTML("")).toBe("");
  });

  it("escapes raw HTML special characters", () => {
    expect(toHTML("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(toHTML("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("renders bold, italic, underline and bold+italic", () => {
    expect(toHTML("**bold**")).toBe("<strong>bold</strong>");
    expect(toHTML("*italic*")).toBe("<em>italic</em>");
    expect(toHTML("_italic_")).toBe("<em>italic</em>");
    expect(toHTML("__underline__")).toBe("<u>underline</u>");
    expect(toHTML("***both***")).toBe("<strong><em>both</em></strong>");
  });

  it("renders strikethrough and spoilers", () => {
    expect(toHTML("~~gone~~")).toBe("<s>gone</s>");
    expect(toHTML("||secret||")).toBe('<span class="spoiler">secret</span>');
  });

  it("renders inline code", () => {
    expect(toHTML("`code`")).toBe("<code>code</code>");
  });

  it("renders fenced code blocks with a language class", () => {
    expect(toHTML("```js\nconst a = 1;\n```")).toBe(
      '<pre><code class="language-js">const a = 1;</code></pre>'
    );
    expect(toHTML("```plain```")).toBe("<pre><code>plain</code></pre>");
  });

  it("renders a single-line block quote", () => {
    expect(toHTML("> quoted")).toBe("<blockquote>quoted</blockquote>");
  });

  it("merges consecutive single-line block quotes into one element", () => {
    expect(toHTML("> line one\n> line two")).toBe(
      "<blockquote>line one<br>line two</blockquote>"
    );
  });

  it("renders a multiline block quote spanning the rest of the message", () => {
    expect(toHTML(">>> line one\nline two")).toBe(
      "<blockquote>line one<br>line two</blockquote>"
    );
  });

  it("renders headers", () => {
    expect(toHTML("# Header 1")).toBe("<h1>Header 1</h1>");
    expect(toHTML("## Header 2")).toBe("<h2>Header 2</h2>");
    expect(toHTML("### Header 3")).toBe("<h3>Header 3</h3>");
  });

  it("renders subtext", () => {
    expect(toHTML("-# small text")).toBe(
      '<span class="subtext">small text</span>'
    );
  });

  it("renders an unordered list", () => {
    expect(toHTML("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders an ordered list", () => {
    expect(toHTML("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("renders masked links, http(s) only", () => {
    expect(toHTML("[Discord](https://discord.com)")).toBe(
      '<a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>'
    );
    expect(toHTML("[bad](javascript:alert(1))")).toBe(
      "[bad](javascript:alert(1))"
    );
  });

  it("renders an embed-suppressing [title](<url>) link as an anchor", () => {
    expect(toHTML("[Discord](<https://discord.com>)")).toBe(
      '<a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>'
    );
  });

  it("keeps balanced parens in a link target, with no stray paren after it", () => {
    expect(toHTML("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))")).toBe(
      '<a href="https://en.wikipedia.org/wiki/Foo_(bar)" target="_blank" rel="noopener noreferrer">wiki</a>'
    );
  });

  it("renders suppressed embed links as anchors", () => {
    expect(toHTML("<https://discord.com>")).toBe(
      '<a href="https://discord.com" target="_blank" rel="noopener noreferrer">https://discord.com</a>'
    );
  });

  it("leaves mentions, custom emoji and timestamps as literal escaped text", () => {
    expect(toHTML("<@123456789012345678>")).toBe("&lt;@123456789012345678&gt;");
    expect(toHTML("<:pog:123456789012345678>")).toBe(
      "&lt;:pog:123456789012345678&gt;"
    );
    expect(toHTML("<t:1700000000:R>")).toBe("&lt;t:1700000000:R&gt;");
  });

  it("strips a leading @silent marker by default", () => {
    expect(toHTML("@silent @everyone hi")).toBe("@everyone hi");
  });

  it("leaves individual elements as literal text when disabled", () => {
    expect(toHTML("**bold**", { disable: ["bold"] })).toBe("**bold**");
    expect(toHTML("*italic*", { disable: ["italic"] })).toBe("*italic*");
    expect(toHTML("__underline__", { disable: ["underline"] })).toBe(
      "__underline__"
    );
    expect(toHTML("~~gone~~", { disable: ["strikethrough"] })).toBe("~~gone~~");
    expect(toHTML("||secret||", { disable: ["spoiler"] })).toBe("||secret||");
    expect(toHTML("`code`", { disable: ["code"] })).toBe("`code`");
    expect(toHTML("```code```", { disable: ["codeBlock"] })).toBe("```code```");
    expect(toHTML("> quoted", { disable: ["blockQuote"] })).toBe("&gt; quoted");
    expect(toHTML("# Header", { disable: ["header"] })).toBe("# Header");
    expect(toHTML("-# small", { disable: ["subtext"] })).toBe("-# small");
    expect(toHTML("- item", { disable: ["list"] })).toBe("- item");
    expect(
      toHTML("[Discord](https://discord.com)", { disable: ["link"] })
    ).toBe("[Discord](https://discord.com)");
    expect(toHTML("<https://discord.com>", { disable: ["embedLink"] })).toBe(
      "&lt;https://discord.com&gt;"
    );
    expect(toHTML("@silent hi", { disable: ["silent"] })).toBe("@silent hi");
  });

  it("leaves ***text*** fully untouched if either bold or italic is disabled", () => {
    expect(toHTML("***text***", { disable: ["bold"] })).toBe("***text***");
    expect(toHTML("***text***", { disable: ["italic"] })).toBe("***text***");
  });

  it("unescapes backslash-escaped markdown characters", () => {
    expect(toHTML("\\*not bold\\*")).toBe("*not bold*");
  });

  describe("block markers inside another element", () => {
    // Nesting a block element inside an inline one would emit invalid HTML
    // (<strong><blockquote>, <a><h1>, <span><ul>...). A block marker only
    // counts at the true start of a line, which the container already took.
    it("keeps block markers literal inside an inline element", () => {
      expect(toHTML("**# text**")).toBe("<strong># text</strong>");
      expect(toHTML("**> text**")).toBe("<strong>&gt; text</strong>");
      expect(toHTML("~~- text~~")).toBe("<s>- text</s>");
      expect(toHTML("||# text||")).toBe('<span class="spoiler"># text</span>');
      expect(toHTML("[# text](https://x.com)")).toBe(
        '<a href="https://x.com" target="_blank" rel="noopener noreferrer"># text</a>'
      );
    });

    it("keeps block markers literal inside a header or subtext", () => {
      expect(toHTML("# > text")).toBe("<h1>&gt; text</h1>");
      expect(toHTML("# - text")).toBe("<h1>- text</h1>");
      expect(toHTML("-# > text")).toBe(
        '<span class="subtext">&gt; text</span>'
      );
    });

    it("still nests blocks inside a quote or list item", () => {
      expect(toHTML("> # text")).toBe("<blockquote><h1>text</h1></blockquote>");
      expect(toHTML("> - text")).toBe(
        "<blockquote><ul><li>text</li></ul></blockquote>"
      );
      expect(toHTML("- # text")).toBe("<ul><li><h1>text</h1></li></ul>");
    });
  });

  it("handles a realistic mixed message", () => {
    const input = [
      "# Announcement",
      "**Server maintenance** is scheduled for <t:1700000000:F>.",
      "> Please save your work.",
      "- Step one",
      "- Step two",
      "Ping <@123456789012345678> for questions. ||this part is secret||",
    ].join("\n");

    const output = toHTML(input);

    expect(output).toContain("<h1>Announcement</h1>");
    expect(output).toContain(
      "<strong>Server maintenance</strong> is scheduled for &lt;t:1700000000:F&gt;."
    );
    expect(output).toContain("<blockquote>Please save your work.</blockquote>");
    expect(output).toContain("<ul><li>Step one</li><li>Step two</li></ul>");
    expect(output).toContain(
      'Ping &lt;@123456789012345678&gt; for questions. <span class="spoiler">this part is secret</span>'
    );
  });
});

import { describe, expect, it } from "vitest";
import { strip } from "./strip";

describe("strip", () => {
  it("returns an empty string for empty input", () => {
    expect(strip("")).toBe("");
  });

  it("strips bold, italic and bold+italic", () => {
    expect(strip("**bold**")).toBe("bold");
    expect(strip("*italic*")).toBe("italic");
    expect(strip("_italic_")).toBe("italic");
    expect(strip("***bold italic***")).toBe("bold italic");
  });

  it("strips underline", () => {
    expect(strip("__underline__")).toBe("underline");
  });

  it("strips nested combinations", () => {
    expect(strip("**bold and _italic_ text**")).toBe("bold and italic text");
  });

  it("strips strikethrough", () => {
    expect(strip("~~gone~~")).toBe("gone");
  });

  it("strips spoilers", () => {
    expect(strip("||secret||")).toBe("secret");
  });

  it("strips inline code", () => {
    expect(strip("`code`")).toBe("code");
  });

  it("strips fenced code blocks, including the language tag", () => {
    expect(strip("```js\nconst a = 1;\n```")).toBe("const a = 1;");
    expect(strip("```plain```")).toBe("plain");
  });

  it("keeps an intentional blank last line, dropping only the closing fence's own newline", () => {
    expect(strip("```\ncode\n\n```")).toBe("code\n");
  });

  it("strips single-line block quotes", () => {
    expect(strip("> quoted line")).toBe("quoted line");
    expect(strip("> line one\n> line two")).toBe("line one\nline two");
  });

  it("strips multiline block quotes", () => {
    expect(strip(">>> line one\nline two")).toBe("line one\nline two");
  });

  it("strips headers", () => {
    expect(strip("# Header 1")).toBe("Header 1");
    expect(strip("## Header 2")).toBe("Header 2");
    expect(strip("### Header 3")).toBe("Header 3");
  });

  it("strips subtext", () => {
    expect(strip("-# small text")).toBe("small text");
  });

  it("strips list leaders by default", () => {
    expect(strip("- item one\n- item two")).toBe("item one\nitem two");
    expect(strip("1. first\n2. second")).toBe("first\nsecond");
  });

  it("keeps a nested list item's indentation, dropping only the marker", () => {
    expect(strip("- top\n  - nested")).toBe("top\n  nested");
  });

  it("strips masked links, keeping the title", () => {
    expect(strip("[Discord](https://discord.com)")).toBe("Discord");
    expect(strip("[Discord](<https://discord.com>)")).toBe("Discord");
  });

  it("does not leave a stray paren behind for a link target containing parens", () => {
    expect(strip("[wiki](https://en.wikipedia.org/wiki/Foo_(bar))")).toBe(
      "wiki"
    );
  });

  it("strips a link whose target is padded with whitespace", () => {
    expect(strip("[a]( https://x.com )")).toBe("a");
    expect(strip("[a]( <https://x.com> )")).toBe("a");
  });

  it("strips angle brackets from suppressed embed links", () => {
    expect(strip("<https://discord.com>")).toBe("https://discord.com");
  });

  it("leaves mentions and custom emoji untouched", () => {
    expect(strip("<@123456789012345678>")).toBe("<@123456789012345678>");
    expect(strip("<@&123456789012345678>")).toBe("<@&123456789012345678>");
    expect(strip("<#123456789012345678>")).toBe("<#123456789012345678>");
    expect(strip("<:pog:123456789012345678>")).toBe(
      "<:pog:123456789012345678>"
    );
    expect(strip("<a:pog:123456789012345678>")).toBe(
      "<a:pog:123456789012345678>"
    );
  });

  it("unescapes backslash-escaped markdown characters", () => {
    expect(strip("\\*not bold\\*")).toBe("*not bold*");
  });

  it("collapses blank lines left behind by removed block markup", () => {
    expect(strip("# a\n\n\n\n# b")).toBe("a\n\nb");
  });

  it("leaves timestamps untouched", () => {
    expect(strip("<t:1700000000:R>")).toBe("<t:1700000000:R>");
  });

  it("strips a leading @silent marker by default", () => {
    expect(strip("@silent @everyone hi")).toBe("@everyone hi");
    expect(strip("@SILENT hi")).toBe("hi");
  });

  it("leaves @silent untouched when not at the start of the message", () => {
    expect(strip("hi @silent there")).toBe("hi @silent there");
  });

  describe("disable", () => {
    it("leaves individual elements untouched when disabled", () => {
      expect(strip("**bold**", { disable: ["bold"] })).toBe("**bold**");
      expect(strip("*italic*", { disable: ["italic"] })).toBe("*italic*");
      expect(strip("__underline__", { disable: ["underline"] })).toBe(
        "__underline__"
      );
      expect(strip("~~gone~~", { disable: ["strikethrough"] })).toBe(
        "~~gone~~"
      );
      expect(strip("||secret||", { disable: ["spoiler"] })).toBe("||secret||");
      expect(strip("`code`", { disable: ["code"] })).toBe("`code`");
      expect(strip("```code```", { disable: ["codeBlock"] })).toBe(
        "```code```"
      );
      expect(strip("> quoted", { disable: ["blockQuote"] })).toBe("> quoted");
      expect(strip("# Header", { disable: ["header"] })).toBe("# Header");
      expect(strip("-# small", { disable: ["subtext"] })).toBe("-# small");
      expect(strip("- item", { disable: ["list"] })).toBe("- item");
      expect(
        strip("[Discord](https://discord.com)", { disable: ["link"] })
      ).toBe("[Discord](https://discord.com)");
      expect(strip("<https://discord.com>", { disable: ["embedLink"] })).toBe(
        "<https://discord.com>"
      );
      expect(strip("@silent hi", { disable: ["silent"] })).toBe("@silent hi");
    });

    it("leaves ***text*** fully untouched if either bold or italic is disabled", () => {
      expect(strip("***text***", { disable: ["bold"] })).toBe("***text***");
      expect(strip("***text***", { disable: ["italic"] })).toBe("***text***");
    });
  });

  describe("block markers inside another element", () => {
    // A block marker is only meaningful at the true start of a line. Once a
    // container has claimed that position, a marker in its content is
    // literal text -- matching how Discord renders it.
    it("keeps block markers literal inside an inline element", () => {
      expect(strip("**# text**")).toBe("# text");
      expect(strip("**> text**")).toBe("> text");
      expect(strip("~~- text~~")).toBe("- text");
      expect(strip("||# text||")).toBe("# text");
      expect(strip("[# text](https://x.com)")).toBe("# text");
    });

    it("strips a stack of block markers whichever order they are written in", () => {
      for (const input of [
        "# > text",
        "> # text",
        "-# > text",
        "> -# text",
        "# - text",
        "- # text",
        "# * text",
        "> - text",
        "- > text",
        "> # - text",
      ]) {
        expect(strip(input)).toBe("text");
      }
      expect(strip("- - nested")).toBe("nested");
    });
  });

  describe("degenerate and unbalanced markers", () => {
    it("leaves empty or unpaired markers alone", () => {
      for (const input of ["**", "****", "____", "~~~~", "||||", "``"]) {
        expect(strip(input)).toBe(input);
      }
      expect(strip("**bold*")).toBe("**bold*");
    });

    it("does not treat a 4+ hash run or a space-less hash as a header", () => {
      expect(strip("#### text")).toBe("#### text");
      expect(strip("#no-space")).toBe("#no-space");
    });

    it("does not let inline emphasis span a line break", () => {
      expect(strip("**bold\nacross**")).toBe("**bold\nacross**");
      expect(strip("||spoil\ner||")).toBe("||spoil\ner||");
    });

    it("keeps markdown inside code spans verbatim", () => {
      expect(strip("`**not bold**`")).toBe("**not bold**");
      expect(strip("`<@123>`")).toBe("<@123>");
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

    const output = strip(input);

    expect(output).toContain("Announcement");
    expect(output).toContain(
      "Server maintenance is scheduled for <t:1700000000:F>."
    );
    expect(output).toContain("Please save your work.");
    expect(output).toContain("Step one\nStep two");
    expect(output).toContain(
      "Ping <@123456789012345678> for questions. this part is secret"
    );
    expect(output).not.toContain("**");
    expect(output).not.toContain("||");
  });
});

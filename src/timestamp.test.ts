import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTimestamp } from "./timestamp";

describe("formatTimestamp", () => {
  const unix = 1700000000;
  const date = new Date(unix * 1000);

  it("defaults to style f (short date/time)", () => {
    expect(formatTimestamp(unix, undefined, { locale: "en-US" })).toBe(
      new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date)
    );
  });

  it("formats each explicit style", () => {
    const cases: [string, Intl.DateTimeFormatOptions][] = [
      ["t", { hour: "numeric", minute: "2-digit" }],
      ["T", { hour: "numeric", minute: "2-digit", second: "2-digit" }],
      ["d", { year: "numeric", month: "2-digit", day: "2-digit" }],
      ["D", { year: "numeric", month: "long", day: "numeric" }],
      [
        "F",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      ],
    ];
    for (const [style, formatOptions] of cases) {
      expect(
        formatTimestamp(unix, style as "t" | "T" | "d" | "D" | "F", {
          locale: "en-US",
        })
      ).toBe(new Intl.DateTimeFormat("en-US", formatOptions).format(date));
    }
  });

  describe("style R (relative)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("formats a relative time", () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      expect(formatTimestamp(oneHourAgo, "R", { locale: "en-US" })).toBe(
        "1 hour ago"
      );
    });
  });
});

/** Discord timestamp display style, i.e. the `X` in `<t:unix:X>`. */
export type TimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R";

/** Options for {@link formatTimestamp}. */
export interface FormatTimestampOptions {
  /** BCP 47 locale. Default: the runtime's default locale. */
  locale?: string;
}

const DATE_TIME_FORMATS: Record<
  Exclude<TimestampStyle, "R">,
  Intl.DateTimeFormatOptions
> = {
  t: { hour: "numeric", minute: "2-digit" },
  T: { hour: "numeric", minute: "2-digit", second: "2-digit" },
  d: { year: "numeric", month: "2-digit", day: "2-digit" },
  D: { year: "numeric", month: "long", day: "numeric" },
  f: {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  F: {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
};

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] =
  [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

function formatRelative(date: Date, locale: string | undefined): string {
  const diffSeconds = (date.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  /* c8 ignore next */
  return rtf.format(0, "second");
}

/**
 * Format a Discord timestamp's epoch seconds and style (the `unix` and `X`
 * in `<t:unix:X>`) into a display string.
 *
 * This is deliberately separate from {@link strip}/{@link toHTML}, which
 * leave `<t:unix:style>` tokens untouched — use {@link parse} to pull the
 * `epoch`/`style` out of a message, then call this to render them, since
 * the desired locale/format is caller-specific.
 *
 * `style` defaults to `"f"` (short date/time), matching Discord's own
 * default when a message omits it.
 */
export function formatTimestamp(
  epochSeconds: number,
  style: TimestampStyle = "f",
  options: FormatTimestampOptions = {}
): string {
  const date = new Date(epochSeconds * 1000);
  if (style === "R") return formatRelative(date, options.locale);
  return new Intl.DateTimeFormat(
    options.locale,
    DATE_TIME_FORMATS[style]
  ).format(date);
}

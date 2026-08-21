const UKRAINIAN_LOCALE = "uk";

const ukrainianCollator = new Intl.Collator(UKRAINIAN_LOCALE);

export const UKRAINIAN_COLLATION = {
  compare: (left: string, right: string): number => ukrainianCollator.compare(left, right),
} as const;

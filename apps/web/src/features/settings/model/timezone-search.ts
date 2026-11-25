import type { TimezoneOption } from "./timezone-options";

type TermMatch = { needle: string; term: string };

const TIMEZONE_SEARCH = {
  matchTiers: [
    ({ needle, term }: TermMatch) => term === needle,
    ({ needle, term }: TermMatch) => term.startsWith(needle),
    ({ needle, term }: TermMatch) => term.includes(needle),
  ],
  separators: /[_\s-]+/g,
  space: " ",
} as const;

export function rankTimezones({
  options,
  query,
}: {
  options: readonly TimezoneOption[];
  query: string;
}): readonly TimezoneOption[] {
  const needle = normalizeSearchText(query);
  if (needle === "") return options;

  const optionsWithTier = options.map((option) => ({
    option,
    tier: bestMatchTier({ needle, terms: option.searchTerms.map(normalizeSearchText) }),
  }));

  return TIMEZONE_SEARCH.matchTiers.flatMap((tier) =>
    optionsWithTier.filter((entry) => entry.tier === tier).map((entry) => entry.option),
  );
}

function bestMatchTier({ needle, terms }: { needle: string; terms: readonly string[] }) {
  return TIMEZONE_SEARCH.matchTiers.find((matches) =>
    terms.some((term) => matches({ needle, term })),
  );
}

function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(TIMEZONE_SEARCH.separators, TIMEZONE_SEARCH.space).trim();
}

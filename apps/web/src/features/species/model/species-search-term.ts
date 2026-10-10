import { SPECIES_SEARCH } from "@app/shared";

export function speciesSearchTerm(text: string): string {
  const trimmed = text.trim();
  return trimmed.length >= SPECIES_SEARCH.minQueryLength ? trimmed : "";
}

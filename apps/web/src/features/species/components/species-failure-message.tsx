"use client";

import { useTranslations } from "next-intl";

import type { SpeciesFailure } from "../model/species-failure";

export function SpeciesFailureMessage({ failure }: { failure: SpeciesFailure }) {
  const t = useTranslations("species.errors");

  return (
    <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error" role="alert">
      {t(failure.kind)}
    </p>
  );
}

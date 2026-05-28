import type { FieldError as RhfFieldError } from "react-hook-form";

import { useTranslation } from "react-i18next";

export function FieldError({ error, id }: { error?: RhfFieldError; id?: string }) {
  const { t } = useTranslation();
  if (!error?.message) return null;
  return (
    <p className="text-xs text-destructive" id={id} role="alert">
      {t(error.message, { defaultValue: error.message })}
    </p>
  );
}

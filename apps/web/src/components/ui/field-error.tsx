import type { FieldError as RhfFieldError } from "react-hook-form";

export function FieldError({ error, id }: { error?: RhfFieldError; id?: string }) {
  if (!error?.message) return null;
  return (
    <p className="text-xs text-destructive" id={id} role="alert">
      {error.message}
    </p>
  );
}

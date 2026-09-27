import type { Message } from "react-hook-form";

export function FieldError({ error, id }: { error?: { message?: Message }; id?: string }) {
  if (!error?.message) return null;
  return (
    <p className="text-xs text-destructive" id={id} role="alert">
      {error.message}
    </p>
  );
}

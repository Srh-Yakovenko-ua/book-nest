"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { passwordStrength } from "../lib/password";

const SEGMENTS = [0, 1, 2, 3] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useTranslations("auth.password");
  const { level, score } = passwordStrength(password);
  const hasInput = password.length > 0;

  const fill = score >= 4 ? "bg-success" : score === 3 ? "bg-primary" : "bg-warning";

  return (
    <div className="mt-2.5" data-slot="password-strength">
      <div aria-hidden className="flex gap-1.5">
        {SEGMENTS.map((segment) => (
          <span
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              hasInput && segment < score ? fill : "bg-secondary",
            )}
            key={segment}
          />
        ))}
      </div>
      {hasInput ? (
        <span className="mt-1.5 block text-xs font-semibold text-muted-foreground">
          {t(`level.${level}`)}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { passwordChecklist, type PasswordRuleId } from "../lib/password";

const RULE_LABELS = {
  case: "case",
  digit: "digit",
  length: "length",
  special: "special",
} as const satisfies Record<PasswordRuleId, string>;

export function PasswordChecklist({ password }: { password: string }) {
  const t = useTranslations("auth.password");
  const rules = passwordChecklist(password);

  return (
    <ul
      className="mt-2.5 grid grid-cols-1 gap-x-3.5 gap-y-1.5 min-[380px]:grid-cols-2"
      data-slot="password-checklist"
    >
      {rules.map((rule) => (
        <li
          className={cn(
            "flex items-center gap-[7px] text-[0.78rem]",
            rule.met ? "text-success" : "text-muted-foreground",
          )}
          key={rule.id}
        >
          <UiIcon
            aria-hidden
            className={cn("shrink-0", rule.met ? "text-success" : "text-muted-foreground")}
            name={rule.met ? "check-circle" : "x-circle"}
            size={15}
          />
          {t(RULE_LABELS[rule.id])}
        </li>
      ))}
    </ul>
  );
}

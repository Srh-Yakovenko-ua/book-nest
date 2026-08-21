"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type LoanContactNameButtonProps = {
  className?: string;
  name: string;
  onOpen: () => void;
};

export function LoanContactNameButton({ className, name, onOpen }: LoanContactNameButtonProps) {
  const t = useTranslations("loans.contactDrawer");

  return (
    <button
      aria-label={t("openContact", { name })}
      className={cn(
        "max-w-full cursor-pointer truncate rounded-sm text-left underline-offset-4 transition-colors outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      onClick={onOpen}
      type="button"
    >
      {name}
    </button>
  );
}

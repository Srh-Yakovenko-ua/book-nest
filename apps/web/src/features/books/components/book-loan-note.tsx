"use client";

import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

type BookLoanNoteProps = {
  className?: string;
  icon: UiIconName;
  text: string;
};

export function BookLoanNote({ className, icon, text }: BookLoanNoteProps) {
  return (
    <p
      className={cn("flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground", className)}
    >
      <UiIcon className="shrink-0 text-icon" name={icon} size={15} />
      <span className="min-w-0 truncate">{text}</span>
    </p>
  );
}

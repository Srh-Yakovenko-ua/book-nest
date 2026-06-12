import * as React from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterPanelProps = React.ComponentProps<"div"> & {
  footer?: React.ReactNode;
  onClear?: () => void;
  onClose?: () => void;
  title?: string;
};

function FilterPanel({
  children,
  className,
  footer,
  onClear,
  onClose,
  title = "Фільтри",
  ...props
}: FilterPanelProps) {
  return (
    <div
      className={cn(
        "flex w-[328px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-pop",
        className,
      )}
      data-slot="filter-panel"
      {...props}
    >
      <div className="flex items-center justify-between gap-2.5 px-[18px] pt-4">
        <h3 className="font-heading text-[1.0625rem] font-bold text-ink">{title}</h3>
        {onClose === undefined ? null : (
          <Button aria-label="Закрити фільтри" onClick={onClose} size="icon-sm" variant="ghost">
            <UiIcon name="x" size={17} />
          </Button>
        )}
      </div>

      {onClear === undefined ? null : (
        <div className="flex justify-end px-[18px] pt-1.5">
          <button
            className="cursor-pointer rounded-sm p-0.5 text-[0.8125rem] font-semibold text-error outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={onClear}
            type="button"
          >
            Скинути всі
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3.5 overflow-y-auto px-[18px] pt-3 pb-4">{children}</div>

      {footer === undefined ? null : (
        <div className="shrink-0 border-t border-border px-[18px] py-3.5">{footer}</div>
      )}
    </div>
  );
}

function FilterSection({
  children,
  className,
  title,
  ...props
}: React.ComponentProps<"div"> & { title: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} data-slot="filter-section" {...props}>
      <span className="text-[0.8125rem] font-semibold text-ink">{title}</span>
      {children}
    </div>
  );
}

export { FilterPanel, FilterSection };

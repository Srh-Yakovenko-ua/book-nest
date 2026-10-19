"use client";

import type {
  FocusEvent,
  FocusEventHandler,
  KeyboardEventHandler,
  MouseEvent,
  ReactNode,
  Ref,
} from "react";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type BookFieldAction = "cancelEditing" | "override" | "reset" | "specify";

export type BookFieldSource = "book" | "editing" | "global";

const SOURCE_ICON = {
  book: "book",
  editing: "edit",
  global: "link",
} as const satisfies Record<BookFieldSource, UiIconName>;

type BookFieldShellProps = {
  action: ReactNode;
  children: ReactNode;
  htmlFor: string | undefined;
  label: ReactNode;
  onBlur: FocusEventHandler<HTMLDivElement>;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  source: BookFieldSource;
};

export function BookFieldActionButton({
  action,
  onClick,
  ref,
}: {
  action: BookFieldAction;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("characters.inheritance.bookField.action");

  return (
    <Button
      className="h-auto self-start p-0"
      onClick={onClick}
      onMouseDown={action === "cancelEditing" ? (event) => event.preventDefault() : undefined}
      ref={ref}
      size="xs"
      type="button"
      variant="link"
    >
      {t(action)}
    </Button>
  );
}

export function BookFieldShell({
  action,
  children,
  htmlFor,
  label,
  onBlur,
  onKeyDown,
  source,
}: BookFieldShellProps) {
  const t = useTranslations("characters.inheritance.bookField.source");
  const labelId = useId();
  const sourceId = useId();

  return (
    <div
      className="min-w-0"
      data-slot="inherited-field"
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onMouseDown={keepFocusOnStaticClick}
      role="presentation"
    >
      <div
        aria-labelledby={`${labelId} ${sourceId}`}
        className="flex min-w-0 flex-col gap-2"
        role="group"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label htmlFor={htmlFor} id={labelId}>
            {label}
          </Label>
          <span className="flex items-center gap-1 text-xs text-muted-foreground" id={sourceId}>
            <UiIcon name={SOURCE_ICON[source]} size={12} />
            {t(source)}
          </span>
        </div>

        {children}

        {action}
      </div>
    </div>
  );
}

export function hasFocusLeftGroup(event: FocusEvent<HTMLElement>) {
  const next = event.relatedTarget;
  if (next instanceof Node && event.currentTarget.contains(next)) return false;
  return !(next === null && document.activeElement === event.target);
}

function keepFocusOnStaticClick(event: MouseEvent<HTMLDivElement>) {
  if (!(event.target instanceof Element)) return;
  if (event.target.closest("input, button, [tabindex]") === null) event.preventDefault();
}

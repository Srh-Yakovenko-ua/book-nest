"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

const actionRowVariants = cva(
  "flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-[0.9375rem] font-medium transition-[background-color,color] outline-none motion-reduce:transition-none",
  {
    variants: {
      tone: {
        default: "text-foreground",
        danger: "text-error",
      },
      interactive: {
        true: "cursor-pointer focus-visible:ring-[3px] focus-visible:ring-ring/50",
        false: "",
      },
    },
    compoundVariants: [
      {
        interactive: true,
        tone: "default",
        className: "hover:bg-secondary active:bg-accent",
      },
      {
        interactive: true,
        tone: "danger",
        className: "hover:bg-error-soft",
      },
    ],
    defaultVariants: {
      tone: "default",
      interactive: false,
    },
  },
);

type ActionRowContentProps = {
  labelId: string;
  leadingIcon?: UiIconName;
  leadingSquare?: boolean;
  subtitle?: string;
  title: string;
  tone: NonNullable<VariantProps<typeof actionRowVariants>["tone"]>;
  trailing?: ActionRowTrailing;
};

type ActionRowProps = Omit<React.ComponentProps<"button">, "title"> & {
  leadingIcon?: UiIconName;
  leadingSquare?: boolean;
  subtitle?: string;
  title: string;
  tone?: NonNullable<VariantProps<typeof actionRowVariants>["tone"]>;
  trailing?: ActionRowTrailing;
};

type ActionRowTrailing = ((labelId: string) => React.ReactNode) | React.ReactNode;

function ActionRow({
  className,
  disabled,
  leadingIcon,
  leadingSquare,
  onClick,
  subtitle,
  title,
  tone = "default",
  trailing,
  type = "button",
  ...props
}: ActionRowProps) {
  const interactive = onClick !== undefined;
  const labelId = React.useId();
  const content: ActionRowContentProps = {
    labelId,
    leadingIcon,
    leadingSquare,
    subtitle,
    title,
    tone,
    trailing,
  };

  if (!interactive) {
    return (
      <div
        className={cn(actionRowVariants({ tone, interactive: false }), className)}
        data-slot="action-row"
      >
        <ActionRowContent {...content} />
      </div>
    );
  }

  return (
    <button
      className={cn(
        actionRowVariants({ tone, interactive: true }),
        "disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
      data-slot="action-row"
      disabled={disabled}
      onClick={onClick}
      type={type}
      {...props}
    >
      <ActionRowContent {...content} />
    </button>
  );
}

function ActionRowContent({
  labelId,
  leadingIcon,
  leadingSquare,
  subtitle,
  title,
  tone,
  trailing,
}: ActionRowContentProps) {
  return (
    <>
      {leadingIcon === undefined ? null : leadingSquare ? (
        <span
          className={cn(
            "grid size-[42px] shrink-0 place-items-center rounded-lg",
            tone === "danger" ? "bg-error-soft text-error" : "bg-accent text-primary",
          )}
        >
          <UiIcon name={leadingIcon} size={20} />
        </span>
      ) : (
        <UiIcon
          className={cn("shrink-0", tone === "danger" ? "text-error" : "text-icon")}
          name={leadingIcon}
          size={20}
        />
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 truncate text-inherit" id={labelId}>
          {title}
        </span>
        {subtitle === undefined ? null : (
          <span className="min-w-0 truncate text-[0.8125rem] font-normal text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>

      {trailing === undefined ? null : (
        <span className="flex shrink-0 items-center gap-2.5 text-[0.8125rem] text-muted-foreground">
          {typeof trailing === "function" ? trailing(labelId) : trailing}
        </span>
      )}
    </>
  );
}

export { ActionRow, actionRowVariants };

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const appBarVariants = cva("z-50 flex h-14 items-center gap-3 border-b border-border px-4", {
  variants: {
    surface: {
      alt: "bg-secondary",
      card: "bg-card",
    },
    sticky: {
      true: "sticky top-0",
      false: "",
    },
  },
  defaultVariants: {
    surface: "alt",
    sticky: true,
  },
});

type AppBarProps = Omit<React.ComponentProps<"header">, "title"> &
  VariantProps<typeof appBarVariants> & {
    leading?: React.ReactNode;
    title?: React.ReactNode;
    titleAs?: "h1" | "h2" | "h3";
    trailing?: React.ReactNode;
  };

function AppBar({
  children,
  className,
  leading,
  sticky,
  surface,
  title,
  titleAs: TitleHeading = "h1",
  trailing,
  ...props
}: AppBarProps) {
  return (
    <header
      className={cn(appBarVariants({ surface, sticky }), className)}
      data-slot="app-bar"
      {...props}
    >
      {leading === undefined ? null : (
        <div className="flex shrink-0 items-center gap-2">{leading}</div>
      )}

      {title === undefined ? null : (
        <TitleHeading className="flex min-w-0 flex-1 items-center gap-2.5 font-heading text-lg leading-none font-bold text-ink">
          {typeof title === "string" ? <span className="min-w-0 truncate">{title}</span> : title}
        </TitleHeading>
      )}

      {children}

      {trailing === undefined ? null : (
        <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </header>
  );
}

export { AppBar, appBarVariants };

"use client";

import { useTranslations } from "next-intl";
import { forwardRef, useState } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
  icon?: UiIconName;
  invalid?: boolean;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField({ className, icon = "lock", invalid, ...props }, ref) {
    const t = useTranslations("auth.common");
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative flex items-center">
        <UiIcon
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3.5",
            invalid === true ? "text-destructive" : "text-muted-foreground",
          )}
          name={icon}
          size={18}
        />
        <input
          className={cn(
            "h-12 w-full rounded-md border border-border bg-card pr-12 pl-11 text-base text-foreground transition-[border-color,box-shadow] duration-150 outline-none",
            "placeholder:text-muted-foreground",
            "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/20",
            invalid === true &&
              "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15",
            className,
          )}
          ref={ref}
          type={visible ? "text" : "password"}
          {...props}
        />
        <button
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          className="absolute right-2 flex size-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          <UiIcon name={visible ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
    );
  },
);

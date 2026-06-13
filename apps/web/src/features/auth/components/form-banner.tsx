import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FormBannerProps = {
  children: ReactNode;
  className?: string;
  variant: FormBannerVariant;
};

type FormBannerVariant = "error" | "success";

const VARIANT_STYLES = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  success: "border-success/30 bg-success-soft text-success",
} as const satisfies Record<FormBannerVariant, string>;

export function FormBanner({ children, className, variant }: FormBannerProps) {
  return (
    <Alert className={cn(VARIANT_STYLES[variant], className)} role="alert">
      <UiIcon name={variant === "success" ? "check-circle" : "alert-circle"} size={16} />
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}

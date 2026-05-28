import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<"input"> & {
  isClearable?: boolean;
  onClear?: () => void;
};

function Input({ className, isClearable, onClear, type, ...props }: InputProps) {
  const baseClasses =
    "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

  if (!isClearable) {
    return (
      <input className={cn(baseClasses, className)} data-slot="input" type={type} {...props} />
    );
  }

  const hasValue = typeof props.value === "string" && props.value.length > 0;

  return (
    <div className="relative flex w-full">
      <input
        className={cn(baseClasses, hasValue && "pr-8", className)}
        data-slot="input"
        type={type}
        {...props}
      />
      {hasValue && (
        <button
          aria-label="Clear"
          className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClear}
          tabIndex={-1}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export { Input };

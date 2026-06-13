"use client";

import { Fragment } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type AuthStep = {
  id: string;
  label: string;
};

type AuthStepperProps = {
  ariaLabel: string;
  current: number;
  onStepSelect?: (index: number) => void;
  steps: readonly AuthStep[];
};

export function AuthStepper({ ariaLabel, current, onStepSelect, steps }: AuthStepperProps) {
  return (
    <nav aria-label={ariaLabel} className="mb-[26px]">
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const active = index === current;
          const done = index < current;
          const reachable = onStepSelect !== undefined && index < current;

          return (
            <Fragment key={step.id}>
              {index === 0 ? null : <li aria-hidden className="h-px flex-1 bg-border" />}
              <li>
                <button
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "-my-2 flex items-center gap-2 bg-transparent py-2 text-[0.82rem] leading-none font-semibold transition-colors",
                    active ? "text-ink" : done ? "text-ink" : "text-muted-foreground",
                    reachable ? "cursor-pointer" : "cursor-default",
                    "focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                  disabled={!reachable}
                  onClick={reachable ? () => onStepSelect(index) : undefined}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 place-items-center rounded-full border text-[0.8rem] transition-colors",
                      active
                        ? "border-transparent bg-primary text-primary-foreground"
                        : done
                          ? "border-transparent bg-success-soft text-success"
                          : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {done ? <UiIcon name="check" size={16} /> : index + 1}
                  </span>
                  {step.label}
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

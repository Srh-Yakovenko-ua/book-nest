"use client";

import * as React from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type Step = {
  description?: string;
  label: string;
};

type StepperProps = {
  className?: string;
  current: number;
  steps: Step[];
};

type StepState = "current" | "done" | "upcoming";

function stateForIndex(index: number, current: number): StepState {
  if (index < current) return "done";
  if (index === current) return "current";
  return "upcoming";
}

function Stepper({ className, current, steps }: StepperProps) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-2.5", className)} data-slot="stepper">
      {steps.map((step, index) => {
        const state = stateForIndex(index, current);
        return (
          <React.Fragment key={step.label}>
            <li
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "inline-flex min-w-0 items-center gap-[11px] rounded-lg border py-[9px] pr-4 pl-[11px]",
                state === "upcoming" && "border-border bg-secondary",
                state === "current" && "border-accent-border bg-accent",
                state === "done" && "border-success/25 bg-success-soft",
              )}
              data-slot="step"
              data-state={state}
            >
              <span
                className={cn(
                  "grid size-[30px] shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-bold tabular-nums",
                  state === "upcoming" && "border-border bg-card text-muted-foreground",
                  state === "current" &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-ring/20",
                  state === "done" && "border-success bg-success text-success-soft",
                )}
                data-slot="step-num"
              >
                {state === "done" ? (
                  <UiIcon className="size-4" name="check" size={16} />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[0.9375rem] font-semibold text-ink">
                  {step.label}
                </span>
                {step.description === undefined ? null : (
                  <span
                    className={cn(
                      "mt-px text-[0.72rem] font-semibold",
                      state === "current" && "text-icon",
                      state === "done" && "text-success",
                      state === "upcoming" && "text-muted-foreground",
                    )}
                  >
                    {step.description}
                  </span>
                )}
              </span>
            </li>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="inline-flex shrink-0 text-muted-foreground opacity-65"
                data-slot="step-separator"
              >
                <UiIcon name="arrow-right" size={20} />
              </span>
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

export { type Step, Stepper };

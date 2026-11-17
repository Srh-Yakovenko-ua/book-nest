"use client";

import type { Nullable } from "@app/shared";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
} from "../model/relationship-form-schema";

import { RelationshipRoleSuggestionCombobox } from "./relationship-role-suggestion-combobox";

const LABEL_FIELDS = {
  source: { errorId: "relationship-source-label-error", name: "sourceLabel" },
  target: { errorId: "relationship-target-label-error", name: "targetLabel" },
} as const;

type LabelSide = keyof typeof LABEL_FIELDS;

const LABEL_SIDES = ["source", "target"] as const satisfies readonly LabelSide[];

type RelationshipLabelFieldsProps = {
  control: RelationshipFormControl;
  defaultOpen: boolean;
  errors: RelationshipFormErrors;
  names: Record<LabelSide, Nullable<string>>;
};

export function RelationshipLabelFields({
  control,
  defaultOpen,
  errors,
  names,
}: RelationshipLabelFieldsProps) {
  const t = useTranslations("relationships.editor.labels");
  const [isExpanded, setExpanded] = useState(defaultOpen);
  const hasError = errors.sourceLabel !== undefined || errors.targetLabel !== undefined;
  const open = isExpanded || hasError;

  return (
    <Collapsible onOpenChange={setExpanded} open={open}>
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between max-sm:min-h-11" type="button" variant="ghost">
          {t("toggle")}
          <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 pt-3">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {LABEL_SIDES.map((side) => {
          const { errorId, name } = LABEL_FIELDS[side];
          const error = errors[name];
          const participantName = names[side];
          const label =
            participantName === null ? t(`${side}Fallback`) : t(side, { name: participantName });

          return (
            <div className="flex min-w-0 flex-col gap-2" key={side}>
              <span aria-hidden className="flex flex-wrap text-sm font-medium text-foreground">
                {label}
              </span>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <RelationshipRoleSuggestionCombobox
                    describedBy={error ? errorId : undefined}
                    invalid={error !== undefined}
                    label={label}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    ref={field.ref}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={error} id={errorId} />
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

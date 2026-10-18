"use client";

import type { Nullable } from "@app/shared";
import type { UseFormRegister } from "react-hook-form";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type {
  RelationshipFormErrors,
  RelationshipFormInput,
} from "../model/relationship-form-schema";

import { RELATIONSHIP_FORM_LIMITS } from "../model/relationship-form-schema";

const LABEL_FIELDS = {
  source: { id: "relationship-source-label", name: "sourceLabel" },
  target: { id: "relationship-target-label", name: "targetLabel" },
} as const;

type LabelSide = keyof typeof LABEL_FIELDS;

const LABEL_SIDES = ["source", "target"] as const satisfies readonly LabelSide[];

type RelationshipLabelFieldsProps = {
  defaultOpen: boolean;
  errors: RelationshipFormErrors;
  names: Record<LabelSide, Nullable<string>>;
  register: UseFormRegister<RelationshipFormInput>;
};

export function RelationshipLabelFields({
  defaultOpen,
  errors,
  names,
  register,
}: RelationshipLabelFieldsProps) {
  const t = useTranslations("relationships.editor.labels");
  const [isExpanded, setExpanded] = useState(defaultOpen);
  const hasError = errors.sourceLabel !== undefined || errors.targetLabel !== undefined;
  const open = isExpanded || hasError;

  return (
    <Collapsible onOpenChange={setExpanded} open={open}>
      <CollapsibleTrigger asChild>
        <Button className="w-full justify-between" type="button" variant="ghost">
          {t("toggle")}
          <ChevronDown aria-hidden className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 pt-3">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {LABEL_SIDES.map((side) => {
          const { id, name } = LABEL_FIELDS[side];
          const error = errors[name];
          const errorId = `${id}-error`;
          const participantName = names[side];

          return (
            <div className="flex min-w-0 flex-col gap-2" key={side}>
              <Label className="flex-wrap" htmlFor={id}>
                {participantName === null
                  ? t(`${side}Fallback`)
                  : t(side, { name: participantName })}
              </Label>
              <Input
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error !== undefined}
                autoComplete="off"
                className="h-10"
                id={id}
                maxLength={RELATIONSHIP_FORM_LIMITS.labelMax}
                placeholder={t("placeholder")}
                {...register(name)}
              />
              <FieldError error={error} id={errorId} />
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

"use client";

import type { UseFormRegister } from "react-hook-form";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipFormInput,
} from "../model/relationship-form-schema";

import { RelationshipPositionFields } from "./relationship-position-fields";

type RelationshipCreatePositionsSectionProps = {
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  register: UseFormRegister<RelationshipFormInput>;
};

export function RelationshipCreatePositionsSection({
  control,
  errors,
  onOpenChange,
  open,
  register,
}: RelationshipCreatePositionsSectionProps) {
  const t = useTranslations("relationships.editor.positions");

  return (
    <Collapsible
      className="flex min-w-0 flex-col gap-3 border-t border-border pt-3"
      onOpenChange={onOpenChange}
      open={open}
    >
      <CollapsibleTrigger asChild>
        <Button
          className="h-11 w-full justify-between px-0 hover:bg-transparent sm:h-10"
          type="button"
          variant="ghost"
        >
          <span>{t("section")}</span>
          <ChevronDown
            aria-hidden
            className="text-muted-foreground transition-transform group-data-[state=open]/button:rotate-180 motion-reduce:transition-none"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex min-w-0 flex-col gap-5">
        <RelationshipPositionFields
          control={control}
          edge="introduced"
          errors={errors}
          register={register}
        />
        <RelationshipPositionFields
          control={control}
          edge="ended"
          errors={errors}
          register={register}
        />
        <p className="text-xs text-muted-foreground">{t("chapterHint")}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

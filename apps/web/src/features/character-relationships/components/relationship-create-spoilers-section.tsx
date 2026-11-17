"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
} from "../model/relationship-form-schema";

import { RelationshipSwitchField } from "./relationship-switch-field";

const CREATE_SPOILER_FIELDS = {
  descriptionSpoiler: "relationship-create-description-spoiler",
  hideRelationship: "relationship-create-hide-relationship",
  typeSpoiler: "relationship-create-type-spoiler",
} as const;

type RelationshipCreateSpoilersSectionProps = {
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type SpoilerSummary = "summaryHidden" | "summaryNone" | "summarySome";

export function RelationshipCreateSpoilersSection({
  control,
  errors,
  onOpenChange,
  open,
}: RelationshipCreateSpoilersSectionProps) {
  const t = useTranslations("relationships.editor.spoilers");
  const [isTypeSpoiler, isDescriptionSpoiler, hideRelationshipAsSpoiler] = useWatch({
    control,
    name: [
      "bookState.isTypeSpoiler",
      "bookState.isDescriptionSpoiler",
      "bookState.hideRelationshipAsSpoiler",
    ],
  });
  const spoilerErrors = errors.bookState;
  const summary = toSpoilerSummary({
    hideRelationshipAsSpoiler,
    isDescriptionSpoiler,
    isTypeSpoiler,
  });

  return (
    <Collapsible
      className="flex min-w-0 flex-col gap-3 border-t border-border pt-3"
      onOpenChange={onOpenChange}
      open={open}
    >
      <CollapsibleTrigger asChild>
        <Button
          className="h-auto min-h-11 w-full justify-between gap-3 px-0 py-2 text-left hover:bg-transparent sm:min-h-10"
          type="button"
          variant="ghost"
        >
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span>{t("section")}</span>
            {open ? null : (
              <span className="text-xs font-normal whitespace-normal text-muted-foreground">
                {t(summary)}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className="text-muted-foreground transition-transform group-data-[state=open]/button:rotate-180 motion-reduce:transition-none"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex min-w-0 flex-col gap-4">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        <RelationshipSwitchField
          control={control}
          description={t("typeHint")}
          error={spoilerErrors?.isTypeSpoiler}
          id={CREATE_SPOILER_FIELDS.typeSpoiler}
          label={t("type")}
          name="bookState.isTypeSpoiler"
        />
        <RelationshipSwitchField
          control={control}
          description={t("descriptionHint")}
          error={spoilerErrors?.isDescriptionSpoiler}
          id={CREATE_SPOILER_FIELDS.descriptionSpoiler}
          label={t("description")}
          name="bookState.isDescriptionSpoiler"
        />
        <Separator />
        <RelationshipSwitchField
          control={control}
          description={t("relationshipHint")}
          error={spoilerErrors?.hideRelationshipAsSpoiler}
          id={CREATE_SPOILER_FIELDS.hideRelationship}
          label={t("relationship")}
          name="bookState.hideRelationshipAsSpoiler"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function toSpoilerSummary({
  hideRelationshipAsSpoiler,
  isDescriptionSpoiler,
  isTypeSpoiler,
}: {
  hideRelationshipAsSpoiler: boolean;
  isDescriptionSpoiler: boolean;
  isTypeSpoiler: boolean;
}): SpoilerSummary {
  if (hideRelationshipAsSpoiler) return "summaryHidden";
  return isTypeSpoiler || isDescriptionSpoiler ? "summarySome" : "summaryNone";
}

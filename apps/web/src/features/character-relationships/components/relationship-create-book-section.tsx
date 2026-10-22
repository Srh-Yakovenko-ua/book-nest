"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { FieldError } from "@/components/ui/field-error";
import { assertNever } from "@/lib/assert-never";

import type {
  RelationshipCreateBookBlockReason,
  RelationshipCreateBookContext,
} from "../model/relationship-book-step";
import type {
  RelationshipFormControl,
  RelationshipFormErrors,
} from "../model/relationship-form-schema";

import { RelationshipBookField } from "./relationship-book-field";

type RelationshipCreateBookSectionProps = {
  context: RelationshipCreateBookContext;
  control: RelationshipFormControl;
  error: RelationshipFormErrors["bookId"];
  onBookChange: (bookId: Nullable<string>) => void;
};

export function RelationshipCreateBookSection({
  context,
  control,
  error,
  onBookChange,
}: RelationshipCreateBookSectionProps) {
  const t = useTranslations("relationships.editor.book");
  const errorId = useId();
  const field = { control, error, noBookLabel: t("placeholder"), onBookChange };

  switch (context.kind) {
    case "auto":
      return <FieldError error={error} id={errorId} />;
    case "blocked":
      return <BlockedBookContext reason={context.reason} />;
    case "choice":
      return (
        <RelationshipBookField
          {...field}
          preferInitialFocus
          step={{ kind: "required", options: context.options }}
        />
      );
    case "fixed":
      return <RelationshipBookField {...field} step={{ book: context.book, kind: "fixed" }} />;
    default:
      return assertNever(context);
  }
}

function BlockedBookContext({ reason }: { reason: RelationshipCreateBookBlockReason }) {
  const t = useTranslations("relationships.editor.book.blocked");

  function copy(): { description: string; title: string } {
    switch (reason) {
      case "character-without-books":
        return { description: t("characterDescription"), title: t("characterTitle") };
      case "series-without-books":
        return { description: t("seriesDescription"), title: t("seriesTitle") };
      default:
        return assertNever(reason);
    }
  }

  const { description, title } = copy();

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center"
      role="status"
    >
      <UiIcon aria-hidden className="text-muted-foreground" name="book-x" size={24} />
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Multiselect } from "@/components/ui/multiselect";
import { Switch } from "@/components/ui/switch";

import type { CreateBookFormValues } from "../model/create-book-form";

import { useListsSearch } from "../api/use-lists-search";
import {
  BOOK_LIST_IDS_MAX,
  BOOK_NEW_LISTS_MAX,
  draftListValue,
  type ListDraft,
  QUEUE_PRIORITY_DEFAULT,
  splitListSelection,
} from "../model/book-organization-fields";
import { shouldShowReadingQueue } from "../model/reading-queue-visibility";
import { LIBRARY_ORGANIZATION_FIELDS } from "../model/section-completeness";
import { CreateListDialog } from "./create-list-dialog";
import { FormSection } from "./form-section";
import { QueuePrioritySection } from "./queue-priority";
import { useSectionCompletion } from "./use-section-completion";

type LibraryOrganizationSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  onRequestQueueRemoval?: (apply: () => void) => void;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function LibraryOrganizationSection({
  control,
  errors,
  onRequestQueueRemoval,
  setValue,
}: LibraryOrganizationSectionProps) {
  const t = useTranslations("books");
  const favoriteSwitchId = useId();
  const queueSwitchId = useId();
  const [dialogOpen, setDialogOpen] = useState(false);

  const addToReadingQueue = useWatch({ control, name: "addToReadingQueue" }) ?? false;
  const readingStatus = useWatch({ control, name: "readingStatus" });
  const listIds = useWatch({ control, name: "listIds" }) ?? [];
  const newLists = useWatch({ control, name: "newLists" }) ?? [];

  const { data: lists = [] } = useListsSearch("");

  const selectedIds = listIds.filter((value): value is string => typeof value === "string");
  const drafts = newLists.filter((draft): draft is ListDraft => typeof draft?.name === "string");
  const atListsMax = selectedIds.length + drafts.length >= BOOK_LIST_IDS_MAX;
  const atDraftsMax = drafts.length >= BOOK_NEW_LISTS_MAX;
  const complete = useSectionCompletion(control, LIBRARY_ORGANIZATION_FIELDS);

  const listsErrorMessage =
    typeof errors.listIds?.message === "string" ? errors.listIds.message : undefined;

  const showQueueToggle = !readingStatus || shouldShowReadingQueue(readingStatus);

  useEffect(() => {
    if (showQueueToggle || !addToReadingQueue) return;
    setValue("addToReadingQueue", false, { shouldValidate: true });
    setValue("queuePriority", undefined, { shouldValidate: true });
  }, [showQueueToggle, addToReadingQueue, setValue]);

  function applyQueueChange(checked: boolean) {
    setValue("addToReadingQueue", checked, { shouldValidate: true });
    setValue("queuePriority", checked ? QUEUE_PRIORITY_DEFAULT : undefined, {
      shouldValidate: true,
    });
    if (checked) return;
    setValue("queuePriorityReason", null, { shouldValidate: true });
    setValue("queuePriorityReasonCustomText", null, { shouldValidate: true });
    setValue("queuePriorityTargetDate", null, { shouldValidate: true });
  }

  function handleQueueChange(checked: boolean) {
    if (!checked && onRequestQueueRemoval) {
      onRequestQueueRemoval(() => applyQueueChange(false));
      return;
    }
    applyQueueChange(checked);
  }

  function addDraft(draft: ListDraft) {
    setValue("newLists", [...drafts, draft], { shouldValidate: true });
  }

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("organization.description")}
      icon="bookmark"
      title={t("organization.title")}
    >
      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-secondary/40 px-4 py-3">
        <Label className="cursor-pointer" htmlFor={favoriteSwitchId}>
          <UiIcon className="text-primary" name="heart" size={18} />
          {t("organization.favorite")}
        </Label>
        <Controller
          control={control}
          name="isFavorite"
          render={({ field }) => (
            <Switch
              checked={field.value ?? false}
              id={favoriteSwitchId}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      {showQueueToggle ? (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Label className="cursor-pointer" htmlFor={queueSwitchId}>
              <UiIcon className="text-primary" name="bookmark" size={18} />
              {t("organization.queue")}
            </Label>
            <Controller
              control={control}
              name="addToReadingQueue"
              render={({ field }) => (
                <Switch
                  checked={field.value ?? false}
                  id={queueSwitchId}
                  onCheckedChange={handleQueueChange}
                />
              )}
            />
          </div>

          {addToReadingQueue ? (
            <div className="motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
              <QueuePrioritySection control={control} errors={errors} setValue={setValue} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="book-lists">{t("organization.lists")}</Label>
        <Controller
          control={control}
          name="listIds"
          render={({ field }) => {
            const selected = (field.value ?? []).filter(
              (value): value is string => typeof value === "string",
            );
            return (
              <Multiselect
                emptyText={t("organization.listsEmpty")}
                id="book-lists"
                onValueChange={(next) => {
                  const result = splitListSelection({ drafts, selection: next });
                  field.onChange(result.listIds.slice(0, BOOK_LIST_IDS_MAX));
                  setValue("newLists", result.newLists, { shouldValidate: true });
                }}
                options={[
                  ...lists
                    .filter((list) => !atListsMax || selected.includes(list.id))
                    .map((list) => ({ label: list.name, value: list.id })),
                  ...drafts.map((draft) => ({
                    label: draft.name,
                    value: draftListValue(draft.name),
                  })),
                ]}
                placeholder={t("organization.listsPlaceholder")}
                searchPlaceholder={t("organization.listsSearch")}
                value={[...selected, ...drafts.map((draft) => draftListValue(draft.name))]}
              />
            );
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("organization.listsHint")}</p>
          <Button
            className="shrink-0"
            disabled={atDraftsMax || atListsMax}
            onClick={() => setDialogOpen(true)}
            size="sm"
            type="button"
            variant="secondary"
          >
            <UiIcon name="plus" size={16} />
            {t("organization.createList")}
          </Button>
        </div>
        {listsErrorMessage ? (
          <p className="text-xs text-destructive" id="book-lists-error" role="alert">
            {listsErrorMessage}
          </p>
        ) : null}
      </div>

      <CreateListDialog onConfirm={addDraft} onOpenChange={setDialogOpen} open={dialogOpen} />
    </FormSection>
  );
}

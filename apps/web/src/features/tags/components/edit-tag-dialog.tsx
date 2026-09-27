"use client";

import type { Nullable, TagCatalogListItem } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { TagFormValues } from "../model/tag-form";

import { useUpdateTag } from "../api/use-update-tag";
import { createTagFormSchema, isDuplicateTagNameError, toTagUpdatePatch } from "../model/tag-form";
import { TagFormFields } from "./tag-form-fields";

type EditTagDialogProps = {
  onOpenChange: (open: boolean) => void;
  tag: Nullable<TagCatalogListItem>;
};

export function EditTagDialog({ onOpenChange, tag }: EditTagDialogProps) {
  const t = useTranslations("tags.tagDialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={tag !== null}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editSubtitle")}</DialogDescription>
        </DialogHeader>
        {tag === null ? null : (
          <EditTagForm key={tag.id} onDone={() => onOpenChange(false)} tag={tag} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditTagForm({ onDone, tag }: { onDone: () => void; tag: TagCatalogListItem }) {
  const t = useTranslations("tags.tagDialog");
  const tErrors = useTranslations("tags.errors");
  const updateTag = useUpdateTag();
  const [formError, setFormError] = useState<Nullable<string>>(null);

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    setError,
  } = useForm<TagFormValues>({
    defaultValues: {
      color: tag.color,
      description: tag.description ?? "",
      name: tag.name,
      type: tag.type,
    },
    mode: "onTouched",
    resolver: zodResolver(
      createTagFormSchema({
        descriptionTooLong: tErrors("descriptionTooLong"),
        nameInvalidChars: tErrors("nameInvalidChars"),
        nameRequired: tErrors("nameRequired"),
        nameTooLong: tErrors("nameTooLong"),
        nameTooShort: tErrors("nameTooShort"),
      }),
    ),
  });

  const onSubmit = handleSubmit((values) => {
    if (updateTag.isPending) return;
    setFormError(null);
    const input = toTagUpdatePatch(values, tag);

    if (Object.keys(input).length === 0) {
      onDone();
      return;
    }

    updateTag.mutate(
      { id: tag.id, input },
      {
        onError: (error) => {
          if (isDuplicateTagNameError(error)) {
            setError(
              "name",
              { message: tErrors("duplicate"), type: "server" },
              { shouldFocus: true },
            );
            return;
          }
          setFormError(tErrors("updateFailed"));
        },
        onSuccess: () => {
          toast.success(t("editSuccess"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <TagFormFields control={control} errors={errors} idPrefix="edit-tag" register={register} />

      {formError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={!isDirty || updateTag.isPending}
          loading={updateTag.isPending}
          type="submit"
        >
          {t("editSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

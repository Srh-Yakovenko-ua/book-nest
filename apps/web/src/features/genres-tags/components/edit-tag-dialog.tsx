"use client";

import type { UpdateTagInput } from "@app/shared";

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
import { ApiError } from "@/lib/http-client";

import type { TagFormValues } from "../model/tag-form";
import type { TagCardItem } from "../model/tags-derive";

import { useUpdateTag } from "../api/use-update-tag";
import { createTagFormSchema } from "../model/tag-form";
import { TagFormFields } from "./tag-form-fields";

const DUPLICATE_STATUS = 409;

type EditTagDialogProps = {
  onOpenChange: (open: boolean) => void;
  tag: null | TagCardItem;
};

export function EditTagDialog({ onOpenChange, tag }: EditTagDialogProps) {
  const t = useTranslations("genresTags.tagDialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={tag !== null}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editSubtitle")}</DialogDescription>
        </DialogHeader>
        {tag === null ? null : <EditTagForm onDone={() => onOpenChange(false)} tag={tag} />}
      </DialogContent>
    </Dialog>
  );
}

function EditTagForm({ onDone, tag }: { onDone: () => void; tag: TagCardItem }) {
  const t = useTranslations("genresTags.tagDialog");
  const tErrors = useTranslations("genresTags.errors");
  const updateTag = useUpdateTag();
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
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
    setServerError(null);
    const input: UpdateTagInput = {
      color: values.color,
      description: values.description === "" ? null : values.description,
      name: values.name,
      type: values.type,
    };

    updateTag.mutate(
      { id: tag.id, input },
      {
        onError: (error) =>
          setServerError(
            error instanceof ApiError && error.status === DUPLICATE_STATUS
              ? tErrors("duplicate")
              : tErrors("updateFailed"),
          ),
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

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={updateTag.isPending} loading={updateTag.isPending} type="submit">
          {t("editSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

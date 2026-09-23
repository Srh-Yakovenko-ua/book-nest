"use client";

import type { CreateTagInput } from "@app/shared";

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

import { useCreateTag } from "../api/use-create-tag";
import { TAG_COLOR_DEFAULT } from "../model/tag-color";
import { createTagFormSchema } from "../model/tag-form";
import { TagFormFields } from "./tag-form-fields";

const DUPLICATE_STATUS = 409;

type AddTagDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddTagDialog({ onOpenChange, open }: AddTagDialogProps) {
  const t = useTranslations("genresTags.tagDialog");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addSubtitle")}</DialogDescription>
        </DialogHeader>
        {open ? <AddTagForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddTagForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("genresTags.tagDialog");
  const tErrors = useTranslations("genresTags.errors");
  const createTag = useCreateTag();
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TagFormValues>({
    defaultValues: {
      color: TAG_COLOR_DEFAULT,
      description: "",
      name: "",
      type: "custom",
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
    const payload: CreateTagInput = {
      color: values.color,
      name: values.name,
      type: values.type,
      ...(values.description === "" ? {} : { description: values.description }),
    };

    createTag.mutate(payload, {
      onError: (error) =>
        setServerError(
          error instanceof ApiError && error.status === DUPLICATE_STATUS
            ? tErrors("duplicate")
            : tErrors("createFailed"),
        ),
      onSuccess: () => {
        toast.success(t("addSuccess"));
        onDone();
      },
    });
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <TagFormFields control={control} errors={errors} idPrefix="add-tag" register={register} />

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={createTag.isPending} loading={createTag.isPending} type="submit">
          {t("addSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

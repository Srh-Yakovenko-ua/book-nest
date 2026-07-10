"use client";

import type { CustomListCard, UpdateListInput } from "@app/shared";

import { UpdateListInputSchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/http-client";

import { useUpdateList } from "../api/use-update-list";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;
const DUPLICATE_STATUS = 409;

type EditListDialogProps = {
  list: CustomListCard;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ListFormInput = z.input<typeof UpdateListInputSchema>;
type ListFormOutput = z.output<typeof UpdateListInputSchema>;

export function EditListDialog({ list, onOpenChange, open }: EditListDialogProps) {
  const t = useTranslations("lists.manage");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
        </DialogHeader>
        {open ? <EditListForm list={list} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditListForm({ list, onDone }: { list: CustomListCard; onDone: () => void }) {
  const t = useTranslations("lists.manage");
  const updateList = useUpdateList(list.id);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<ListFormInput, unknown, ListFormOutput>({
    defaultValues: { description: list.description ?? "", name: list.name },
    mode: "onTouched",
    resolver: zodResolver(UpdateListInputSchema),
  });

  const name = useWatch({ control, name: "name" });
  const description = useWatch({ control, name: "description" });
  const hasChanges =
    (name ?? "").trim() !== list.name.trim() ||
    (description ?? "").trim() !== (list.description ?? "").trim();

  const onSubmit = handleSubmit((values) => {
    const nextDescription = values.description?.trim();
    const payload: UpdateListInput = {
      name: values.name,
      ...(nextDescription ? { description: nextDescription } : {}),
    };
    updateList.mutate(payload, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === DUPLICATE_STATUS) {
          setError("name", { message: t("errors.duplicate") });
          return;
        }
        toast.error(t("toast.error"));
      },
      onSuccess: () => {
        toast.success(t("toast.updated"));
        onDone();
      },
    });
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-list-name">{t("fields.name")}</Label>
        <Input
          aria-describedby={errors.name ? "edit-list-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="edit-list-name"
          maxLength={NAME_MAX}
          placeholder={t("fields.namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="edit-list-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="edit-list-description">{t("fields.description")}</Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby="edit-list-description-counter"
                id="edit-list-description"
                maxLength={DESCRIPTION_MAX}
                onChange={field.onChange}
                placeholder={t("fields.descriptionPlaceholder")}
                value={field.value ?? ""}
              />
              <span
                className="ml-auto text-xs text-muted-foreground tabular-nums"
                id="edit-list-description-counter"
              >
                {(field.value ?? "").length}/{DESCRIPTION_MAX}
              </span>
            </>
          )}
        />
      </div>

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {t("actions.cancel")}
        </Button>
        <Button
          disabled={!hasChanges || updateList.isPending}
          loading={updateList.isPending}
          type="submit"
        >
          {t("actions.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import type { NewListInput } from "@app/shared";

import { NewListInputSchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/http-client";

import { useCreateList } from "../api/use-create-list";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 300;
const DUPLICATE_STATUS = 409;

type CreateListDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ListFormInput = z.input<typeof NewListInputSchema>;
type ListFormOutput = z.output<typeof NewListInputSchema>;

export function CreateListDialog({ onOpenChange, open }: CreateListDialogProps) {
  const t = useTranslations("lists.manage");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
          <DialogDescription>{t("create.subtitle")}</DialogDescription>
        </DialogHeader>
        {open ? <CreateListForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateListForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("lists.manage");
  const tCatalog = useTranslations("lists.catalog");
  const createList = useCreateList();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
  } = useForm<ListFormInput, unknown, ListFormOutput>({
    defaultValues: { description: "", name: "" },
    mode: "onTouched",
    resolver: zodResolver(NewListInputSchema),
  });

  const onSubmit = handleSubmit((values) => {
    const description = values.description?.trim();
    const payload: NewListInput = {
      name: values.name,
      ...(description ? { description } : {}),
    };
    createList.mutate(payload, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === DUPLICATE_STATUS) {
          setError("name", { message: t("errors.duplicate") });
          return;
        }
        toast.error(t("toast.error"));
      },
      onSuccess: () => {
        toast.success(t("toast.created"));
        onDone();
      },
    });
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-list-name">{t("fields.name")}</Label>
        <Input
          aria-describedby={errors.name ? "new-list-name-error" : undefined}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          className="h-10"
          id="new-list-name"
          maxLength={NAME_MAX}
          placeholder={t("fields.namePlaceholder")}
          {...register("name")}
        />
        <FieldError error={errors.name} id="new-list-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-list-description">{t("fields.description")}</Label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby="new-list-description-counter"
                id="new-list-description"
                maxLength={DESCRIPTION_MAX}
                onChange={field.onChange}
                placeholder={t("fields.descriptionPlaceholder")}
                value={field.value ?? ""}
              />
              <span
                className="ml-auto text-xs text-muted-foreground tabular-nums"
                id="new-list-description-counter"
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
        <Button disabled={createList.isPending} loading={createList.isPending} type="submit">
          {tCatalog("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

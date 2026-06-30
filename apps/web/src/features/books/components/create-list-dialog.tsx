"use client";

import { NewListInputSchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  LIST_DESCRIPTION_MAX,
  LIST_NAME_MAX,
  type ListDraft,
} from "../model/book-organization-fields";

type CreateListDialogProps = {
  onConfirm: (draft: ListDraft) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type CreateListFormProps = {
  onCancel: () => void;
  onConfirm: (draft: ListDraft) => void;
};

export function CreateListDialog({ onConfirm, onOpenChange, open }: CreateListDialogProps) {
  const t = useTranslations("books");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("list.create.title")}</DialogTitle>
          <DialogDescription>{t("list.create.description")}</DialogDescription>
        </DialogHeader>
        <CreateListForm
          onCancel={() => onOpenChange(false)}
          onConfirm={(draft) => {
            onConfirm(draft);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreateListForm({ onCancel, onConfirm }: CreateListFormProps) {
  const t = useTranslations("books");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const trimmedDescription = description.trim();
    const parsed = NewListInputSchema.safeParse({
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      name,
    });

    if (!parsed.success) {
      const nameIssue = parsed.error.issues.find((issue) => issue.path[0] === "name");
      setNameError(nameIssue?.message ?? t("list.create.nameInvalid"));
      return;
    }

    onConfirm(parsed.data);
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-list-name">{t("list.create.name")}</Label>
        <Input
          aria-describedby={nameError ? "new-list-name-error" : undefined}
          aria-invalid={nameError !== undefined}
          autoComplete="off"
          className="h-10"
          id="new-list-name"
          isClearable
          maxLength={LIST_NAME_MAX}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(undefined);
          }}
          onClear={() => {
            setName("");
            if (nameError) setNameError(undefined);
          }}
          placeholder={t("list.create.namePlaceholder")}
          value={name}
        />
        {nameError ? (
          <p className="text-xs text-destructive" id="new-list-name-error" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-list-description">
          {t("list.create.descriptionLabel")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("fields.optional")}</span>
        </Label>
        <Textarea
          aria-describedby="new-list-description-counter"
          id="new-list-description"
          maxLength={LIST_DESCRIPTION_MAX}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("list.create.descriptionPlaceholder")}
          value={description}
        />
        <span
          className="ml-auto text-xs text-muted-foreground tabular-nums"
          id="new-list-description-counter"
        >
          {description.length}/{LIST_DESCRIPTION_MAX}
        </span>
      </div>

      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="secondary">
          {t("actions.cancel")}
        </Button>
        <Button type="submit">{t("list.create.confirm")}</Button>
      </DialogFooter>
    </form>
  );
}

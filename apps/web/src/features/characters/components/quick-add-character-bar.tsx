"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCreateCharacterInBook } from "../api/use-create-character-in-book";
import { useDuplicateCandidates } from "../api/use-duplicate-candidates";
import {
  emptyCharacterFormValues,
  toBookProfileInput,
  toCharacterInput,
} from "../model/character-form-schema";
import { DuplicateCharacterSuggestion } from "./duplicate-character-suggestion";

const DUPLICATE_DEBOUNCE_MS = 350;

type QuickAddCharacterBarProps = {
  bookId: string;
  onLinkExisting: (characterId: string) => void;
  onMoreFields: (name: string) => void;
};

export function QuickAddCharacterBar({
  bookId,
  onLinkExisting,
  onMoreFields,
}: QuickAddCharacterBarProps) {
  const t = useTranslations("characters.quickAdd");
  const tToast = useTranslations("characters.toast");
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const createInBook = useCreateCharacterInBook();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedName(name), DUPLICATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [name]);

  const duplicates = useDuplicateCandidates({ name: debouncedName });
  const candidates = duplicates.data?.candidates ?? [];

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    const values = { ...emptyCharacterFormValues({ name: trimmed }), description: note };

    createInBook.mutate(
      {
        bookId,
        input: {
          bookProfile: toBookProfileInput(values),
          character: toCharacterInput(values, bookId),
          mode: "new",
        },
      },
      {
        onError: () => toast.error(tToast("createError")),
        onSuccess: () => {
          toast.success(tToast("created"));
          setName("");
          setNote("");
          setDebouncedName("");
          nameRef.current?.focus();
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="quick-add-name">{t("nameLabel")}</Label>
          <Input
            autoComplete="off"
            className="h-10"
            id="quick-add-name"
            onChange={(event) => setName(event.target.value)}
            placeholder={t("namePlaceholder")}
            ref={nameRef}
            value={name}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="quick-add-note">{t("noteLabel")}</Label>
          <Input
            autoComplete="off"
            className="h-10"
            id="quick-add-note"
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("notePlaceholder")}
            value={note}
          />
        </div>

        <Button
          className="h-10 shrink-0"
          disabled={name.trim().length === 0 || createInBook.isPending}
          loading={createInBook.isPending}
          type="submit"
        >
          <UiIcon name="plus" size={16} />
          {t("add")}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-2">
        <Button
          className="h-auto p-0"
          onClick={() => onMoreFields(name.trim())}
          size="xs"
          type="button"
          variant="link"
        >
          {t("moreFields")}
        </Button>
      </div>

      {candidates.length > 0 ? (
        <DuplicateCharacterSuggestion
          candidates={candidates}
          onCreateAnyway={submit}
          onUse={onLinkExisting}
        />
      ) : null}
    </div>
  );
}

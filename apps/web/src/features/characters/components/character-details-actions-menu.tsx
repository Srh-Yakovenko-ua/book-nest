"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";

import { useUnlinkCharacter } from "../api/use-unlink-character";
import { getBookCharactersPath, getCharacterDetailsPath } from "../model/character-routes";
import { useDeleteCharacterWithUndo } from "../model/use-delete-character-with-undo";
import { DeleteCharacterDialog } from "./delete-character-dialog";
import { UnlinkCharacterDialog } from "./unlink-character-dialog";

type CharacterDetailsActionsMenuProps = {
  characterId: string;
  className?: string;
  contextBookId: Nullable<string>;
  editHref: string;
};

export function CharacterDetailsActionsMenu({
  characterId,
  className,
  contextBookId,
  editHref,
}: CharacterDetailsActionsMenuProps) {
  const t = useTranslations("characters.page");
  const tCard = useTranslations("characters.card");
  const tToast = useTranslations("characters.toast");
  const router = useRouter();
  const unlinkCharacter = useUnlinkCharacter();
  const deleteCharacter = useDeleteCharacterWithUndo();
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmUnlink() {
    if (contextBookId === null) return;
    unlinkCharacter.mutate(
      { bookId: contextBookId, characterId },
      {
        onError: () => toast.error(tToast("unlinkError")),
        onSuccess: () => {
          toast.success(tToast("unlinked"));
          setUnlinkOpen(false);
          router.push(getCharacterDetailsPath({ characterId }));
        },
      },
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={tCard("menu")} className={className} size="icon" variant="outline">
            <UiIcon name="more" size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem asChild>
            <Link href={editHref}>
              <UiIcon name="edit" size={16} />
              {t("edit")}
            </Link>
          </DropdownMenuItem>
          {contextBookId === null ? null : (
            <DropdownMenuItem onSelect={() => setUnlinkOpen(true)}>
              <UiIcon name="book-x" size={16} />
              {tCard("unlink")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDeleteOpen(true)} variant="destructive">
            <UiIcon name="trash" size={16} />
            {t("deleteAction")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UnlinkCharacterDialog
        isUnlinking={unlinkCharacter.isPending}
        onConfirm={confirmUnlink}
        onOpenChange={setUnlinkOpen}
        open={unlinkOpen}
      />

      <DeleteCharacterDialog
        characterId={characterId}
        isDeleting={deleteCharacter.isPending}
        onConfirm={() =>
          deleteCharacter.deleteWithUndo(characterId, () => {
            setDeleteOpen(false);
            router.push(
              contextBookId === null ? "/my-library" : getBookCharactersPath(contextBookId),
            );
          })
        }
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
}

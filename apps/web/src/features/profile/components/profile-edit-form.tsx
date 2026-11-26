"use client";

import type { ProfileView } from "@app/shared";

import { PROFILE_INPUT_LIMITS } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";

import type { useUpdateProfile } from "../api/use-update-profile";
import type { ProfileFormInput, ProfileFormValues } from "../model/profile-form";

import {
  changedProfileFields,
  PROFILE_NICKNAME_TAKEN,
  ProfileFormSchema,
  toProfileFormInput,
} from "../model/profile-form";
import { ProfileFieldError } from "./profile-field-error";

type ProfileEditFormProps = {
  onCancel: () => void;
  onDirtyChange: (isDirty: boolean) => void;
  onSaved: () => void;
  profile: ProfileView;
  updateProfile: ReturnType<typeof useUpdateProfile>;
};

export function ProfileEditForm({
  onCancel,
  onDirtyChange,
  onSaved,
  profile,
  updateProfile,
}: ProfileEditFormProps) {
  const t = useTranslations("profile");
  const fieldId = useId();
  const ids = {
    bio: `${fieldId}-bio`,
    bioError: `${fieldId}-bio-error`,
    bioHint: `${fieldId}-bio-hint`,
    name: `${fieldId}-name`,
    nameError: `${fieldId}-name-error`,
    nickname: `${fieldId}-nickname`,
    nicknameError: `${fieldId}-nickname-error`,
    nicknameHint: `${fieldId}-nickname-hint`,
  };
  const [openedProfile] = useState(profile);

  const {
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    setError,
    setFocus,
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    defaultValues: toProfileFormInput(openedProfile),
    mode: "onTouched",
    resolver: zodResolver(ProfileFormSchema),
  });

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setFocus("name"));
    return () => cancelAnimationFrame(frame);
  }, [setFocus]);

  const serverError = errors.root?.server?.message;

  const onSubmit = handleSubmit(async (values) => {
    const changes = changedProfileFields({ initial: openedProfile, values });
    if (Object.keys(changes).length === 0) {
      onSaved();
      return;
    }

    try {
      await updateProfile.mutateAsync(changes);
    } catch (error) {
      if (isApiErrorStatus(error, HTTP_STATUS.conflict)) {
        setError("nickname", { type: PROFILE_NICKNAME_TAKEN }, { shouldFocus: true });
        return;
      }
      setError("root.server", { message: t("dialog.saveError") });
      return;
    }

    toast.success(t("dialog.saved"));
    onSaved();
  });

  return (
    <form className="flex min-h-0 flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 py-0.5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.name}>{t("fields.name")}</Label>
          <Input
            aria-describedby={errors.name ? ids.nameError : undefined}
            aria-invalid={errors.name !== undefined}
            aria-required="true"
            autoComplete="name"
            id={ids.name}
            {...register("name")}
          />
          <ProfileFieldError error={errors.name} field="name" id={ids.nameError} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.nickname}>{t("fields.nickname")}</Label>
          <Input
            aria-describedby={
              errors.nickname ? `${ids.nicknameHint} ${ids.nicknameError}` : ids.nicknameHint
            }
            aria-invalid={errors.nickname !== undefined}
            autoCapitalize="none"
            autoComplete="nickname"
            id={ids.nickname}
            spellCheck={false}
            {...register("nickname")}
          />
          <p className="text-xs leading-relaxed text-muted-foreground" id={ids.nicknameHint}>
            {t("fields.nicknameHint", {
              max: PROFILE_INPUT_LIMITS.nicknameMax,
              min: PROFILE_INPUT_LIMITS.nicknameMin,
            })}
          </p>
          <ProfileFieldError error={errors.nickname} field="nickname" id={ids.nicknameError} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.bio}>{t("fields.bio")}</Label>
          <Textarea
            aria-describedby={errors.bio ? `${ids.bioHint} ${ids.bioError}` : ids.bioHint}
            aria-invalid={errors.bio !== undefined}
            className="min-h-20"
            id={ids.bio}
            {...register("bio")}
          />
          <p className="text-xs leading-relaxed text-muted-foreground" id={ids.bioHint}>
            {t("fields.bioHint", { max: PROFILE_INPUT_LIMITS.bioMax })}
          </p>
          <ProfileFieldError error={errors.bio} field="bio" id={ids.bioError} />
        </div>

        <dl className="flex flex-col gap-1">
          <dt className="text-sm font-medium text-foreground">{t("fields.email")}</dt>
          <dd className="text-sm break-all text-muted-foreground">
            {openedProfile.email === "" ? t("fields.emailMissing") : openedProfile.email}
          </dd>
        </dl>
      </div>

      {serverError === undefined ? null : (
        <p
          className="shrink-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {serverError}
        </p>
      )}

      <DialogFooter className="shrink-0">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">
          {t("dialog.cancel")}
        </Button>
        <Button disabled={!isDirty || isSubmitting} loading={isSubmitting} type="submit">
          {t("dialog.save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

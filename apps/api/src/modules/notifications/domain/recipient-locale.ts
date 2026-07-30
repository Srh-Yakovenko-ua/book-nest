import type { InterfaceLanguage, Nullable } from "@app/shared";

import { defaultUserProfileSettings, InterfaceLanguageSchema } from "@app/shared";

export function resolveRecipientLocale(language: Nullable<string>): InterfaceLanguage {
  return InterfaceLanguageSchema.catch(defaultUserProfileSettings.language).parse(language);
}

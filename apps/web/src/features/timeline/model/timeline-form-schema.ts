import type { CreateTimelineInput } from "@app/shared";

import { TimelineColorKeySchema } from "@app/shared";
import { z } from "zod";

export const TIMELINE_NAME_MAX = 100;
export const TIMELINE_DESCRIPTION_MAX = 500;

export type TimelineFormMessages = {
  descriptionTooLong: string;
  nameEmpty: string;
  nameTooLong: string;
};

export type TimelineFormValues = z.infer<ReturnType<typeof buildTimelineFormSchema>>;

export function buildTimelineFormSchema(messages: TimelineFormMessages) {
  return z.object({
    colorKey: TimelineColorKeySchema.nullable(),
    description: z
      .string()
      .trim()
      .max(TIMELINE_DESCRIPTION_MAX, { error: messages.descriptionTooLong }),
    name: z
      .string()
      .trim()
      .min(1, { error: messages.nameEmpty })
      .max(TIMELINE_NAME_MAX, { error: messages.nameTooLong }),
  });
}

export function timelineFormValuesToInput(values: TimelineFormValues): CreateTimelineInput {
  const description = values.description.trim();

  return {
    colorKey: values.colorKey,
    description: description.length > 0 ? description : null,
    name: values.name.trim(),
  };
}

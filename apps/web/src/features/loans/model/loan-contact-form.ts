import { CreateLoanContactInputSchema } from "@app/shared";
import { z } from "zod";

const CONTACT_FIELDS = CreateLoanContactInputSchema.shape;

export type LoanContactFormMessages = {
  contactInvalid: string;
  nameInvalid: string;
};

export type LoanContactFormValues = {
  contact: string;
  name: string;
};

export function buildLoanContactFormSchema(messages: LoanContactFormMessages) {
  return z.object({
    contact: z
      .string()
      .refine(
        (value) => value.trim() === "" || CONTACT_FIELDS.contact.safeParse(value).success,
        messages.contactInvalid,
      ),
    name: z.string().refine((value) => CONTACT_FIELDS.name.safeParse(value).success, {
      message: messages.nameInvalid,
    }),
  });
}

export function toLoanContactPayload(values: LoanContactFormValues): {
  contact: null | string;
  name: string;
} {
  const contact = values.contact.trim();

  return { contact: contact === "" ? null : contact, name: values.name.trim() };
}

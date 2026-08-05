const MASK_VISIBLE_CHARS = 2;
const MASKED_PLACEHOLDER = "***";
const EMAIL_IN_TEXT_PATTERN = /[^\s<>@,;]+@[^\s<>@,;]+/g;

export function maskEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) {
    return MASKED_PLACEHOLDER;
  }
  const visible = email.slice(0, Math.min(MASK_VISIBLE_CHARS, atIndex));
  return `${visible}${MASKED_PLACEHOLDER}${email.slice(atIndex)}`;
}

export function maskEmailsInText(text: string): string {
  return text.replaceAll(EMAIL_IN_TEXT_PATTERN, (match) => maskEmail(match));
}

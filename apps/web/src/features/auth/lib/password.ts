const MIN_LENGTH = 8;
const STRONG_LENGTH = 12;
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

export type PasswordLevel = "medium" | "strong" | "weak";

export type PasswordRule = {
  id: PasswordRuleId;
  met: boolean;
};

export type PasswordRuleId = "case" | "digit" | "length" | "special";

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export type PasswordStrength = {
  level: PasswordLevel;
  score: PasswordScore;
};

export function passwordChecklist(password: string): PasswordRule[] {
  return [
    { id: "length", met: password.length >= MIN_LENGTH },
    { id: "case", met: HAS_UPPER.test(password) && HAS_LOWER.test(password) },
    { id: "digit", met: HAS_DIGIT.test(password) },
    { id: "special", met: HAS_SPECIAL.test(password) },
  ];
}

export function passwordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { level: "weak", score: 0 };

  let score = 0;
  if (password.length >= MIN_LENGTH) score += 1;
  if (HAS_UPPER.test(password) && HAS_LOWER.test(password)) score += 1;
  if (HAS_DIGIT.test(password)) score += 1;
  if (HAS_SPECIAL.test(password)) score += 1;

  const scaled: PasswordScore = score as PasswordScore;
  const bumped = password.length >= STRONG_LENGTH;

  return { level: toLevel(scaled, bumped), score: scaled };
}

function toLevel(score: PasswordScore, bumped: boolean): PasswordLevel {
  if (score >= 4) return "strong";
  if (score >= 2) return bumped ? "strong" : "medium";
  return bumped ? "medium" : "weak";
}

import type { Day } from "date-fns";

import { z } from "zod";

import { type Nullable } from "./common.js";
import { boundedUrlSchema, HTTPS_PROTOCOL, NoHtmlString, notInFutureDate } from "./internal.js";

export const PROFILE_INPUT_LIMITS = {
  bioMax: 300,
  genreMax: 50,
  genresMax: 10,
  nameMax: 50,
  nameMin: 2,
  nicknameMax: 30,
  nicknameMin: 3,
  quoteMax: 200,
} as const satisfies Record<string, number>;

const PROFILE_NICKNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;

const ProfileNameSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.min(PROFILE_INPUT_LIMITS.nameMin, "Must be at least 2 characters long").max(
      PROFILE_INPUT_LIMITS.nameMax,
      "Must be at most 50 characters long",
    ),
  );

const ProfileNicknameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(
    NoHtmlString.min(
      PROFILE_INPUT_LIMITS.nicknameMin,
      "Nickname must be at least 3 characters long",
    )
      .max(PROFILE_INPUT_LIMITS.nicknameMax, "Nickname must be at most 30 characters long")
      .regex(
        PROFILE_NICKNAME_PATTERN,
        "Nickname may contain only letters, digits, dot, hyphen and underscore",
      ),
  );

const ProfileBioSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(PROFILE_INPUT_LIMITS.bioMax, "Bio must be at most 300 characters long"));

const ProfileQuoteSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.max(PROFILE_INPUT_LIMITS.quoteMax, "Quote must be at most 200 characters long"),
  );

const ProfileDateOfBirthSchema = notInFutureDate("Date of birth must not be in the future");

const ProfileGenresSchema = z
  .array(
    z
      .string()
      .trim()
      .pipe(
        NoHtmlString.min(1, "Genre must not be empty").max(
          PROFILE_INPUT_LIMITS.genreMax,
          "Genre must be at most 50 characters long",
        ),
      ),
  )
  .max(PROFILE_INPUT_LIMITS.genresMax, "You can select at most 10 genres")
  .refine((genres) => {
    const seen = new Set(genres.map((genre) => genre.toLowerCase()));
    return seen.size === genres.length;
  }, "Genres must not contain duplicates");

export const AuthProviderSchema = z.enum(["PASSWORD", "GOOGLE", "APPLE"]);

export type AuthProvider = z.infer<typeof AuthProviderSchema>;

export const UpdateProfileInputSchema = z.object({
  bio: ProfileBioSchema.nullable().optional(),
  dateOfBirth: ProfileDateOfBirthSchema.nullable().optional(),
  favoriteBookQuote: ProfileQuoteSchema.nullable().optional(),
  favoriteGenres: ProfileGenresSchema.optional(),
  lastName: ProfileNameSchema.optional(),
  name: ProfileNameSchema.optional(),
  nickname: ProfileNicknameSchema.nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

const SOCIAL_USERNAME_MIN = 2;
const SOCIAL_USERNAME_MAX = 50;
const SOCIAL_URL_MAX = 300;
const SOCIAL_LABEL_MAX = 40;
const SOCIAL_USERNAME_NO_SPACES = /^\S+$/;

export const SocialPlatformSchema = z.enum([
  "INSTAGRAM",
  "TIKTOK",
  "TWITTER",
  "THREADS",
  "YOUTUBE",
  "GOODREADS",
  "STORYGRAPH",
  "TELEGRAM",
  "WEBSITE",
  "OTHER",
]);

export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

const SocialUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(
    NoHtmlString.min(SOCIAL_USERNAME_MIN, "Username must be at least 2 characters long")
      .max(SOCIAL_USERNAME_MAX, "Username must be at most 50 characters long")
      .regex(SOCIAL_USERNAME_NO_SPACES, "Username must not contain spaces"),
  );

const SocialUrlSchema = boundedUrlSchema({
  maxLength: SOCIAL_URL_MAX,
  protocol: HTTPS_PROTOCOL,
  urlError: "Enter a valid https link",
});

const SocialLabelSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(SOCIAL_LABEL_MAX, "Label must be at most 40 characters long"));

export const CreateSocialLinkInputSchema = z
  .object({
    label: SocialLabelSchema.optional(),
    platform: SocialPlatformSchema,
    url: SocialUrlSchema.optional(),
    username: SocialUsernameSchema.optional(),
  })
  .refine(
    (value) =>
      (value.username !== undefined && value.username.length > 0) ||
      (value.url !== undefined && value.url.length > 0),
    { error: "Add a username or a profile link", path: ["username"] },
  );

export type CreateSocialLinkInput = z.infer<typeof CreateSocialLinkInputSchema>;

export const UpdateSocialLinkInputSchema = z.object({
  label: SocialLabelSchema.nullable().optional(),
  platform: SocialPlatformSchema.optional(),
  url: SocialUrlSchema.nullable().optional(),
  username: SocialUsernameSchema.nullable().optional(),
});

export const SocialLinkViewSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  label: z.string().nullable(),
  platform: SocialPlatformSchema,
  updatedAt: z.string(),
  url: z.string().nullable(),
  username: z.string().nullable(),
});

export type SocialLinkView = z.infer<typeof SocialLinkViewSchema>;

export const ProfileViewSchema = z.object({
  authProvider: AuthProviderSchema,
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string(),
  dateOfBirth: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean(),
  favoriteBookQuote: z.string().nullable(),
  favoriteGenres: z.array(z.string()),
  lastName: z.string().nullable(),
  name: z.string(),
  nickname: z.string().nullable(),
  socialLinks: z.array(SocialLinkViewSchema),
  updatedAt: z.string(),
  userId: z.string(),
});

export type ProfileView = z.infer<typeof ProfileViewSchema>;

export type UpdateSocialLinkInput = z.infer<typeof UpdateSocialLinkInputSchema>;

const TIMEZONE_MAX = 64;
const TIMEZONE_FALLBACK = "Europe/Kyiv";

export const LOAN_REMINDER_LEAD_DAYS = {
  default: 3,
  max: 14,
  min: 1,
} as const satisfies Record<string, number>;

export const ThemeModeSchema = z.enum(["light", "dark", "system"]);

export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const AccentColorSchema = z.enum(["brown", "orange", "yellow", "green", "blue", "purple"]);

export type AccentColor = z.infer<typeof AccentColorSchema>;

export const InterfaceLanguageSchema = z.enum(["uk", "en"]);

export type InterfaceLanguage = z.infer<typeof InterfaceLanguageSchema>;

export const DateFormatSchema = z.enum(["DD.MM.YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]);

export type DateFormat = z.infer<typeof DateFormatSchema>;

export const WeekStartDaySchema = z.enum(["monday", "sunday"]);

export type WeekStartDay = z.infer<typeof WeekStartDaySchema>;

export const WEEK_STARTS_ON = { monday: 1, sunday: 0 } as const satisfies Record<WeekStartDay, Day>;

export const LibraryViewModeSchema = z.enum(["grid", "list"]);

export type LibraryViewMode = z.infer<typeof LibraryViewModeSchema>;

export const EmailNotificationsSchema = z.object({
  borrowedBookReminders: z.boolean(),
  deliveryReminders: z.boolean(),
  monthlyReadingReport: z.boolean(),
  readingGoalReminders: z.boolean(),
  readingReminders: z.boolean(),
  weeklyReadingSummary: z.boolean(),
});

export type EmailNotifications = z.infer<typeof EmailNotificationsSchema>;

const NAMED_TIME_ZONES = new Set([...Intl.supportedValuesOf("timeZone"), "UTC"]);

const toCanonicalTimeZone = (value: string): Nullable<string> => {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

const isNamedTimeZone = (value: string): boolean => {
  if (NAMED_TIME_ZONES.has(value)) {
    return true;
  }
  const canonical = toCanonicalTimeZone(value);
  return canonical !== null && NAMED_TIME_ZONES.has(canonical);
};

const SettingsTimezoneSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.min(1, "Timezone must not be empty").max(
      TIMEZONE_MAX,
      "Timezone must be at most 64 characters long",
    ),
  )
  .pipe(z.string().refine(isNamedTimeZone, "Timezone must be a valid IANA time zone"));

export const StoredTimezoneSchema = SettingsTimezoneSchema.catch(TIMEZONE_FALLBACK);

const LoanReminderLeadDaysSchema = z
  .number()
  .int()
  .min(LOAN_REMINDER_LEAD_DAYS.min, "Reminder lead time must be at least 1 day")
  .max(LOAN_REMINDER_LEAD_DAYS.max, "Reminder lead time must be at most 14 days");

export const StoredLoanReminderLeadDaysSchema = LoanReminderLeadDaysSchema.catch(
  LOAN_REMINDER_LEAD_DAYS.default,
);

export const UpdateSettingsInputSchema = z.object({
  accentColor: AccentColorSchema.optional(),
  confirmBeforeDelete: z.boolean().optional(),
  dateFormat: DateFormatSchema.optional(),
  emailNotifications: EmailNotificationsSchema.partial().optional(),
  language: InterfaceLanguageSchema.optional(),
  libraryViewMode: LibraryViewModeSchema.optional(),
  loanReminderLeadDays: LoanReminderLeadDaysSchema.optional(),
  themeMode: ThemeModeSchema.optional(),
  timezone: SettingsTimezoneSchema.optional(),
  weekStartDay: WeekStartDaySchema.optional(),
});

export const SettingsViewSchema = z.object({
  accentColor: AccentColorSchema,
  confirmBeforeDelete: z.boolean(),
  dateFormat: DateFormatSchema,
  emailNotifications: EmailNotificationsSchema,
  language: InterfaceLanguageSchema,
  libraryViewMode: LibraryViewModeSchema,
  loanReminderLeadDays: StoredLoanReminderLeadDaysSchema,
  themeMode: ThemeModeSchema,
  timezone: StoredTimezoneSchema,
  weekStartDay: WeekStartDaySchema,
});

export type SettingsView = z.infer<typeof SettingsViewSchema>;

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

export const defaultUserProfileSettings = {
  accentColor: "brown",
  confirmBeforeDelete: true,
  dateFormat: "DD.MM.YYYY",
  emailNotifications: {
    borrowedBookReminders: true,
    deliveryReminders: true,
    monthlyReadingReport: false,
    readingGoalReminders: false,
    readingReminders: false,
    weeklyReadingSummary: false,
  },
  language: "uk",
  libraryViewMode: "grid",
  loanReminderLeadDays: LOAN_REMINDER_LEAD_DAYS.default,
  themeMode: "system",
  timezone: TIMEZONE_FALLBACK,
  weekStartDay: "monday",
} as const satisfies SettingsView;

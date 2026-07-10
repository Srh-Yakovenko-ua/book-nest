import { z } from "zod";

import { noHtmlTags, type Nullable } from "./common.js";
import { HTTPS_PROTOCOL, NoHtmlString, notInFutureDate } from "./internal.js";

const PROFILE_NAME_MIN = 2;
const PROFILE_NAME_MAX = 50;
const PROFILE_NICKNAME_MIN = 3;
const PROFILE_NICKNAME_MAX = 30;
const PROFILE_NICKNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;
const PROFILE_BIO_MAX = 300;
const PROFILE_QUOTE_MAX = 200;
const PROFILE_GENRES_MAX = 10;
const PROFILE_GENRE_MAX = 50;

const ProfileNameSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.min(PROFILE_NAME_MIN, "Must be at least 2 characters long").max(
      PROFILE_NAME_MAX,
      "Must be at most 50 characters long",
    ),
  );

const ProfileNicknameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ""))
  .pipe(
    NoHtmlString.min(PROFILE_NICKNAME_MIN, "Nickname must be at least 3 characters long")
      .max(PROFILE_NICKNAME_MAX, "Nickname must be at most 30 characters long")
      .regex(
        PROFILE_NICKNAME_PATTERN,
        "Nickname may contain only letters, digits, dot, hyphen and underscore",
      ),
  );

const ProfileBioSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(PROFILE_BIO_MAX, "Bio must be at most 300 characters long"));

const ProfileQuoteSchema = z
  .string()
  .trim()
  .pipe(NoHtmlString.max(PROFILE_QUOTE_MAX, "Quote must be at most 200 characters long"));

const ProfileDateOfBirthSchema = notInFutureDate("Date of birth must not be in the future");

const ProfileGenresSchema = z
  .array(
    z
      .string()
      .trim()
      .pipe(
        NoHtmlString.min(1, "Genre must not be empty").max(
          PROFILE_GENRE_MAX,
          "Genre must be at most 50 characters long",
        ),
      ),
  )
  .max(PROFILE_GENRES_MAX, "You can select at most 10 genres")
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

const SocialUrlSchema = z
  .string()
  .trim()
  .max(SOCIAL_URL_MAX, "URL must be at most 300 characters long")
  .refine(noHtmlTags, "HTML tags are not allowed")
  .pipe(z.url({ error: "Enter a valid https link", protocol: HTTPS_PROTOCOL }));

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

export type ProfileView = {
  authProvider: AuthProvider;
  avatarUrl: Nullable<string>;
  bio: Nullable<string>;
  createdAt: string;
  dateOfBirth: Nullable<string>;
  email: string;
  emailVerified: boolean;
  favoriteBookQuote: Nullable<string>;
  favoriteGenres: string[];
  lastName: Nullable<string>;
  name: string;
  nickname: Nullable<string>;
  socialLinks: SocialLinkView[];
  updatedAt: string;
  userId: string;
};

export type SocialLinkView = {
  createdAt: string;
  id: string;
  label: Nullable<string>;
  platform: SocialPlatform;
  updatedAt: string;
  url: Nullable<string>;
  username: Nullable<string>;
};

export type UpdateSocialLinkInput = z.infer<typeof UpdateSocialLinkInputSchema>;

const TIMEZONE_MAX = 64;

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

const SettingsTimezoneSchema = z
  .string()
  .trim()
  .pipe(
    NoHtmlString.min(1, "Timezone must not be empty").max(
      TIMEZONE_MAX,
      "Timezone must be at most 64 characters long",
    ),
  );

export const UpdateSettingsInputSchema = z.object({
  accentColor: AccentColorSchema.optional(),
  confirmBeforeDelete: z.boolean().optional(),
  dateFormat: DateFormatSchema.optional(),
  emailNotifications: EmailNotificationsSchema.partial().optional(),
  language: InterfaceLanguageSchema.optional(),
  libraryViewMode: LibraryViewModeSchema.optional(),
  themeMode: ThemeModeSchema.optional(),
  timezone: SettingsTimezoneSchema.optional(),
  weekStartDay: WeekStartDaySchema.optional(),
});

export type SettingsView = {
  accentColor: AccentColor;
  confirmBeforeDelete: boolean;
  dateFormat: DateFormat;
  emailNotifications: EmailNotifications;
  language: InterfaceLanguage;
  libraryViewMode: LibraryViewMode;
  themeMode: ThemeMode;
  timezone: string;
  weekStartDay: WeekStartDay;
};

export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

export const defaultUserProfileSettings: SettingsView = {
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
  themeMode: "system",
  timezone: "Europe/Kyiv",
  weekStartDay: "monday",
};

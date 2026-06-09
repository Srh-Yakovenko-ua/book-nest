import { z } from "zod";

export type ApiError = {
  code?: string;
  message: string;
  requestId?: string;
};

export type ApiErrorResult = {
  errorsMessages: FieldError[];
};

export type ApiHealth = {
  postgres: "down" | "ok";
  status: "degraded" | "down" | "ok";
  timestamp: string;
  uptimeSeconds: number;
};

export type FieldError = {
  field: string;
  message: string;
};

export type Paginator<T> = {
  items: T[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export const LIST_PAGE_SIZE_MAX = 100;

export const PaginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(10),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

const NAME_MIN = 2;
const NAME_MAX = 50;
const NAME_ALLOWED = /^[\p{L}\p{M} '’-]+$/u;
const NAME_HAS_LETTER = /\p{L}/u;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const PASSWORD_UPPERCASE = /[A-Z]/;
const PASSWORD_LOWERCASE = /[a-z]/;
const PASSWORD_DIGIT = /[0-9]/;
const PASSWORD_SPECIAL = /[^A-Za-z0-9]/;
const NICKNAME_MIN = 3;
const NICKNAME_MAX = 20;
const NICKNAME_PATTERN = /^[A-Za-z0-9._]+$/;
const NICKNAME_EDGES = /^[A-Za-z0-9].*[A-Za-z0-9]$/;
const NICKNAME_NO_REPEAT = /^(?!.*(?:\.\.|__))/;

const HTML_TAG = /<[^>]*>/;

export const noHtmlTags = (value: string): boolean => !HTML_TAG.test(value);

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN, "Password must be at least 8 characters long")
  .max(PASSWORD_MAX, "Password must be at most 128 characters long")
  .regex(PASSWORD_UPPERCASE, "Password must contain at least one uppercase letter")
  .regex(PASSWORD_LOWERCASE, "Password must contain at least one lowercase letter")
  .regex(PASSWORD_DIGIT, "Password must contain at least one digit")
  .regex(PASSWORD_SPECIAL, "Password must contain at least one special character");

export const RegistrationInputSchema = z.object({
  dateOfBirth: z.iso.date().optional(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX)),
  name: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(NAME_MIN, "Name must be at least 2 characters long")
        .max(NAME_MAX, "Name must be at most 50 characters long")
        .regex(NAME_ALLOWED, "Name may contain only letters, spaces, apostrophes and hyphens")
        .regex(NAME_HAS_LETTER, "Name must contain at least one letter"),
    ),
  nickname: z
    .string()
    .trim()
    .min(NICKNAME_MIN, "Nickname must be at least 3 characters long")
    .max(NICKNAME_MAX, "Nickname must be at most 20 characters long")
    .regex(NICKNAME_PATTERN, "Nickname may contain only Latin letters, digits, underscore and dot")
    .regex(NICKNAME_EDGES, "Nickname must start and end with a letter or digit")
    .regex(NICKNAME_NO_REPEAT, "Nickname must not contain consecutive dots or underscores")
    .optional(),
  password: PasswordSchema,
});

export const RoleSchema = z.enum(["user", "super_admin"]);

export type Role = z.infer<typeof RoleSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const ResendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  password: PasswordSchema,
  token: z.string().min(1),
});

export type AuthResultView = {
  accessToken: string;
  user: UserView;
};

export type ForgotPasswordResultView = { status: "reset_email_sent" };

export type LogoutResultView = { status: "logged_out" };

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

export type RegistrationResultView = {
  email: string;
  status: "verification_sent";
};

export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;

export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export type ResetPasswordResultView = { status: "password_reset" };

export type UserView = {
  createdAt: string;
  dateOfBirth: null | string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  nickname: null | string;
  role: Role;
};

const PROFILE_NAME_MIN = 2;
const PROFILE_NAME_MAX = 50;
const PROFILE_NICKNAME_MIN = 3;
const PROFILE_NICKNAME_MAX = 30;
const PROFILE_NICKNAME_PATTERN = /^[\p{L}\p{N}._-]+$/u;
const PROFILE_BIO_MAX = 300;
const PROFILE_QUOTE_MAX = 200;
const PROFILE_GENRES_MAX = 10;
const PROFILE_GENRE_MAX = 50;

const NoHtmlString = z.string().refine(noHtmlTags, "HTML tags are not allowed");

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

const ProfileDateOfBirthSchema = z.iso.date().refine((value) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${value}T00:00:00.000Z`) <= today;
}, "Date of birth must not be in the future");

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
const HTTPS_PROTOCOL = /^https$/;

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
  avatarUrl: null | string;
  bio: null | string;
  createdAt: string;
  dateOfBirth: null | string;
  email: string;
  emailVerified: boolean;
  favoriteBookQuote: null | string;
  favoriteGenres: string[];
  lastName: null | string;
  name: string;
  nickname: null | string;
  socialLinks: SocialLinkView[];
  updatedAt: string;
  userId: string;
};

export type SocialLinkView = {
  createdAt: string;
  id: string;
  label: null | string;
  platform: SocialPlatform;
  updatedAt: string;
  url: null | string;
  username: null | string;
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

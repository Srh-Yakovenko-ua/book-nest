const HOME_ROOT = "/api/home";

export const homeKeys = {
  activeBooks: () => [`${HOME_ROOT}/reading/books`] as const,
  attention: () => [`${HOME_ROOT}/attention`] as const,
  nextRead: () => [`${HOME_ROOT}/next-read`] as const,
  reading: () => [`${HOME_ROOT}/reading`] as const,
  rootPath: HOME_ROOT,
} as const;

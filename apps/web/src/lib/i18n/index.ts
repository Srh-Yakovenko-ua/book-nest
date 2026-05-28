import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import "./types";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import { getStoredLocale } from "./schema";

i18n.use(initReactI18next).init({
  fallbackLng: "ru",
  interpolation: {
    escapeValue: false,
  },
  lng: getStoredLocale(),
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    uk: { translation: uk },
  },
});

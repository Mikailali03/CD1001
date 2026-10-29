import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import en from "./en.json";
import es from "./es.json";

// Same setup as the web app (artifacts/casa-dossier/src/i18n): English and Spanish,
// one "translation" namespace, English fallback.
export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "casa-dossier.language";

function isSupported(lng: string | null | undefined): lng is AppLanguage {
  return !!lng && (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);
}

/** The device's preferred language if we support it, otherwise English. */
function deviceLanguage(): AppLanguage {
  try {
    for (const locale of getLocales()) {
      if (isSupported(locale.languageCode)) return locale.languageCode;
    }
  } catch {
    // expo-localization unavailable (e.g. tests) — fall through
  }
  return "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: deviceLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

// A choice made in the app beats the device setting
AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((saved) => {
    if (isSupported(saved) && saved !== i18n.language) i18n.changeLanguage(saved);
  })
  .catch(() => {});

export function currentLanguage(): AppLanguage {
  return isSupported(i18n.language) ? i18n.language : "en";
}

/** Switch language and remember the choice. */
export async function setAppLanguage(lng: AppLanguage) {
  await i18n.changeLanguage(lng);
  AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lng).catch(() => {});
}

export default i18n;

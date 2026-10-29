import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";

const saved = typeof localStorage !== "undefined" ? (localStorage.getItem("cd-locale") ?? "en") : "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: saved,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

// Keep <html lang> in sync so screen readers and the browser's spellcheck and
// hyphenation use the right language.
function syncHtmlLang(lng: string) {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
}
syncHtmlLang(i18n.language);
i18n.on("languageChanged", syncHtmlLang);

export default i18n;

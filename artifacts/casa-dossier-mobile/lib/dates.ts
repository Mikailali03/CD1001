import { format as dfFormat } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { currentLanguage } from "@/i18n";

const DATE_FNS_LOCALES = { en: enUS, es } as const;

// Spanish puts the day before the month ("29 oct 2026"). Code is written with
// the English patterns; these are swapped in when Spanish is active.
const SPANISH_PATTERNS: Record<string, string> = {
  "MMM d": "d MMM",
  "MMM d, yyyy": "d MMM yyyy",
  "MMMM d, yyyy": "d 'de' MMMM 'de' yyyy",
  "EEEE, MMMM d": "EEEE, d 'de' MMMM",
  "EEEE, MMMM d, yyyy": "EEEE, d 'de' MMMM 'de' yyyy",
  "EEEE, MMM d": "EEEE, d MMM",
};

/**
 * date-fns `format` in the active app language: localized month and weekday
 * names, plus day-first order for the common English patterns in Spanish.
 */
export function formatDate(date: Date | number | string, pattern: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const lang = currentLanguage();
  const localized = lang === "es" ? (SPANISH_PATTERNS[pattern] ?? pattern) : pattern;
  return dfFormat(d, localized, { locale: DATE_FNS_LOCALES[lang] });
}

/** BCP-47 tag for Intl / toLocale* calls in the active language. */
export function intlLocale(): string {
  return currentLanguage() === "es" ? "es-US" : "en-US";
}

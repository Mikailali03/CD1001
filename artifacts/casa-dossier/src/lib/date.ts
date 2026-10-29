import { format as dfFormat } from "date-fns";
import { enUS, es } from "date-fns/locale";
import i18n from "@/i18n";

/** date-fns locale for the current UI language. */
export function dateLocale() {
  return i18n.language?.startsWith("es") ? es : enUS;
}

/**
 * Drop-in for date-fns `format` that follows the UI language, so month and
 * weekday names switch to Spanish in Spanish mode.
 */
export function format(
  date: Date | number | string,
  formatStr: string,
  options?: Parameters<typeof dfFormat>[2],
): string {
  return dfFormat(date, formatStr, { locale: dateLocale(), ...options });
}

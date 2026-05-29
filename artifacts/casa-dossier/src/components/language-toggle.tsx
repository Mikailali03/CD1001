import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const isSpanish = i18n.language === "es";

  function toggle() {
    const next = isSpanish ? "en" : "es";
    i18n.changeLanguage(next);
    localStorage.setItem("cd-locale", next);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className="h-8 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground px-2"
      title={isSpanish ? "Switch to English" : "Cambiar a Español"}
    >
      <Languages className="h-3.5 w-3.5" />
      {t("lang.toggle")}
    </Button>
  );
}

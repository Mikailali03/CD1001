import { useGetGuide, getGetGuideQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Wrench, AlertCircle, CheckCircle2 } from "lucide-react";

export default function GuideDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  const { data: guide, isLoading } = useGetGuide(id!, {
    query: { enabled: !!id, queryKey: getGetGuideQueryKey(id!) }
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-6 w-24 mb-6" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <div className="flex gap-4 mb-8">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <div className="space-y-4 mt-8">
          <Skeleton className="h-[100px] w-full rounded-xl" />
          <Skeleton className="h-[100px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!guide) return <div className="p-6 text-center">{t("guides.notFound")}</div>;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-chart-1/10 text-chart-1 border-chart-1/20';
      case 'medium': return 'bg-chart-3/10 text-chart-3 border-chart-3/20';
      case 'hard': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <Link href="/guides" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t("guides.backToLibrary")}
      </Link>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-background">{guide.category}</Badge>
          <Badge className={getDifficultyColor(guide.difficulty)} variant="outline">
            {t("guides.difficultyLabel", { level: t(`guides.difficulty.${guide.difficulty}`, { defaultValue: guide.difficulty }) })}
          </Badge>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-primary leading-tight">{guide.title}</h1>
        {guide.description && (
          <p className="text-lg text-muted-foreground max-w-2xl">{guide.description}</p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-secondary/30 border-transparent shadow-none">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-background p-3 rounded-full shadow-sm">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t("guides.estimatedTime")}</p>
              <p className="text-lg font-bold text-foreground">{t("guides.minutes", { count: guide.estimatedMinutes })}</p>
            </div>
          </CardContent>
        </Card>

        {guide.toolsNeeded && guide.toolsNeeded.length > 0 && (
          <Card className="bg-secondary/30 border-transparent shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-4 mb-3">
                <div className="bg-background p-2 rounded-full shadow-sm shrink-0">
                  <Wrench className="h-4 w-4 text-primary" />
                </div>
                <p className="font-medium">{t("guides.toolsRequired")}</p>
              </div>
              <ul className="text-sm text-muted-foreground grid grid-cols-2 gap-x-2 gap-y-1 ml-12">
                {guide.toolsNeeded.map((tool, i) => (
                  <li key={i} className="flex items-center gap-1.5"><span className="h-1 w-1 bg-primary/40 rounded-full"/>{tool}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {guide.difficulty === 'hard' && (
        <div className="bg-destructive/10 text-destructive-foreground border border-destructive/20 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">
            <p className="font-semibold mb-1">{t("guides.advancedWarningTitle")}</p>
            <p>{t("guides.advancedWarningBody")}</p>
          </div>
        </div>
      )}

      <div className="space-y-6 pt-4">
        <h2 className="text-2xl font-bold">{t("guides.instructions")}</h2>
        {guide.steps && guide.steps.length > 0 ? (
          <div className="space-y-6">
            {guide.steps.map((stepItem, i) => (
              <div key={i} className="flex gap-4 md:gap-6 bg-card p-4 sm:p-6 rounded-xl border shadow-sm hover-elevate">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-sm">
                    {stepItem.step}
                  </div>
                </div>
                <div className="pt-2">
                  <p className="text-foreground leading-relaxed">{stepItem.instruction}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">{t("guides.noSteps")}</p>
        )}
      </div>

      <div className="flex justify-center pt-8 pb-12 border-t mt-12">
        <Button size="lg" className="h-14 px-8 text-base font-semibold shadow-md hover-elevate gap-2">
          <CheckCircle2 className="h-5 w-5" />
          {t("guides.markCompleted")}
        </Button>
      </div>
    </div>
  );
}

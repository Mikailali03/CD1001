import { useListGuides } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, Wrench, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Guides() {
  const { data: guides, isLoading } = useListGuides();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-chart-1/10 text-chart-1 border-chart-1/20';
      case 'medium': return 'bg-chart-3/10 text-chart-3 border-chart-3/20';
      case 'hard': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-primary">{t("guides.title")}</h1>
        <p className="text-muted-foreground">{t("guides.subtitle")}</p>
      </div>

      {guides && guides.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {guides.map(guide => (
            <Link key={guide.id} href={`/guides/${guide.id}`}>
              <Card className="h-full flex flex-col hover-elevate cursor-pointer transition-shadow group">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline">{guide.category}</Badge>
                    <Badge className={getDifficultyColor(guide.difficulty)} variant="outline">
                      {t(`guides.difficulty.${guide.difficulty}`, { defaultValue: guide.difficulty })}
                    </Badge>
                  </div>
                  <CardTitle className="line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {guide.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="line-clamp-3">
                    {guide.description}
                  </CardDescription>
                </CardContent>
                <CardFooter className="pt-4 border-t text-sm text-muted-foreground flex justify-between items-center bg-muted/20">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> {t("guides.minutesShort", { count: guide.estimatedMinutes })}</span>
                    {guide.toolsNeeded && guide.toolsNeeded.length > 0 && (
                      <span className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5"/> {t("guides.toolCount", { count: guide.toolsNeeded.length })}</span>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0" />
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">{t("guides.emptyTitle")}</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            {t("guides.emptyBody")}
          </p>
        </div>
      )}
    </div>
  );
}

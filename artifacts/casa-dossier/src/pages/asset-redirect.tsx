import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useLocation, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2, QrCode, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetQrAssetAccess,
  getGetQrAssetAccessQueryKey,
  useGetPublicQrAsset,
  getGetPublicQrAssetQueryKey,
} from "@workspace/api-client-react";

// Used only to build the post-sign-in return URL, not for API calls.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/**
 * Landing page for a scanned asset label (/a/:assetId). Owners and
 * collaborators are forwarded to the asset; technicians are pointed at the
 * tech portal; everyone else sees only the registry ID and category.
 */
export default function AssetRedirect() {
  const { assetId } = useParams<{ assetId: string }>();
  const { isLoaded, isSignedIn } = useAuth();
  const [location, setLocation] = useLocation();
  const { t } = useTranslation();

  const encodedId = encodeURIComponent(assetId);

  const access = useGetQrAssetAccess(encodedId, {
    query: {
      queryKey: getGetQrAssetAccessQueryKey(encodedId),
      enabled: isLoaded && !!isSignedIn && !!assetId,
      retry: false,
    },
  });

  const canOpen = access.data?.hasAccess && access.data.propertyId;

  // A 404 (unknown label) or any other failure leaves `data` undefined, which
  // renders the "label not recognized" card.
  const publicInfo = useGetPublicQrAsset(encodedId, {
    query: {
      queryKey: getGetPublicQrAssetQueryKey(encodedId),
      // Signed-in users wait for the access check so owners go straight through.
      enabled: isLoaded && !!assetId && (!isSignedIn || (access.isFetched && !canOpen)),
      retry: false,
    },
  });

  useEffect(() => {
    if (canOpen) {
      setLocation(`/properties/${access.data!.propertyId}/assets/${access.data!.assetId}`, { replace: true });
    }
  }, [canOpen, access.data, setLocation]);

  const waiting =
    !isLoaded ||
    (isSignedIn && (access.isLoading || canOpen)) ||
    publicInfo.isLoading;

  if (waiting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const info = publicInfo.data;
  const returnTo = encodeURIComponent(`${BASE}${location}`);
  const isTech = !!access.data?.isTechnician;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {info ? <ShieldCheck className="h-6 w-6 text-primary" /> : <QrCode className="h-6 w-6 text-muted-foreground" />}
          </div>

          {info ? (
            <>
              <div className="space-y-1">
                <h1 className="text-lg font-semibold">{t("qr.public.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("qr.public.subtitle")}</p>
              </div>
              <div className="w-full rounded-lg border bg-muted/40 px-4 py-3 space-y-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("qr.public.registryId")}</p>
                <p className="font-mono text-lg font-bold tracking-wide">{info.registryId}</p>
                <p className="text-xs text-muted-foreground">{info.category}</p>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">{t("qr.public.notFoundTitle")}</h1>
              <p className="text-sm text-muted-foreground">{t("qr.public.notFoundBody")}</p>
            </div>
          )}

          {isSignedIn ? (
            <div className="w-full space-y-3">
              {isTech && info && (
                <Button asChild className="w-full gap-2">
                  <a href={`/tech/scan?code=${encodeURIComponent(assetId)}`}>
                    <Wrench className="h-4 w-4" />
                    {t("qr.public.openInTechPortal")}
                  </a>
                </Button>
              )}
              {!isTech && info && (
                <p className="text-xs text-muted-foreground">{t("qr.public.noAccess")}</p>
              )}
              <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
                {t("qr.public.goHome")}
              </Button>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <p className="text-xs text-muted-foreground">{t("qr.public.signInPrompt")}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setLocation(`/sign-in?redirect_url=${returnTo}`)}>
                  {t("qr.public.signIn")}
                </Button>
                <Button className="flex-1" onClick={() => setLocation(`/sign-up?redirect_url=${returnTo}`)}>
                  {t("qr.public.signUp")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

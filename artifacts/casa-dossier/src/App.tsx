import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { PropertyProvider, useProperty } from "@/contexts/property-context";
import { setExtraHeaders } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, Eye } from "lucide-react";

// Pages
import Landing from "@/pages/landing";
import { Onboarding } from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Properties from "@/pages/properties";
import PropertyDetail from "@/pages/property-detail";
import MyAssets from "@/pages/assets";
import AssetDetail from "@/pages/asset-detail";
import IntakeForm from "@/pages/intake";
import Guides from "@/pages/guides";
import GuideDetail from "@/pages/guide-detail";
import Marketplace from "@/pages/marketplace";
import CapitalOutlook from "@/pages/capital-outlook";
import Settings from "@/pages/settings";
import ClaimTransfer from "@/pages/claim";
import PropertyReport from "@/pages/report";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// Only set in production (auto-injected when published), empty in dev
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

const DEMO_TOKEN =
  (import.meta.env.VITE_DEMO_TOKEN as string | undefined) || "casa-demo-preview-2025";

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(222, 47%, 11%)",
    colorForeground: "hsl(222, 47%, 11%)",
    colorMutedForeground: "hsl(215, 20%, 55%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(40, 33%, 98%)",
    colorInput: "hsl(40, 15%, 90%)",
    colorInputForeground: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(40, 15%, 85%)",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary font-semibold hover:underline",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground text-xs",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-border bg-background hover:bg-muted transition-colors",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
    formFieldInput: "border-input bg-background text-foreground",
    footerAction: "bg-muted/30",
    dividerLine: "bg-border",
    alert: "border border-border",
    otpCodeFieldInput: "border-input",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AppRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/assets" component={MyAssets} />
        <Route path="/properties" component={Properties} />
        <Route path="/properties/:id" component={PropertyDetail} />
        <Route path="/properties/:propertyId/assets/:assetId" component={AssetDetail} />
        <Route path="/intake" component={IntakeForm} />
        <Route path="/guides" component={Guides} />
        <Route path="/guides/:id" component={GuideDetail} />
        <Route path="/capital-outlook" component={CapitalOutlook} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/settings" component={Settings} />
        <Route path="/claim/:token" component={ClaimTransfer} />
        <Route path="/properties/:id/report" component={PropertyReport} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { properties, isLoading } = useProperty();
  if (!isLoading && properties.length === 0) return <Onboarding />;
  return <>{children}</>;
}

function ProtectedApp() {
  return (
    <>
      <Show when="signed-in">
        <PropertyProvider>
          <OnboardingGate>
            <AppRoutes />
          </OnboardingGate>
        </PropertyProvider>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

// ---------------------------------------------------------------------------
// Demo mode
// ---------------------------------------------------------------------------

function DemoBanner() {
  const base = basePath;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-amber-900">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Eye className="h-4 w-4 shrink-0" />
        <span>Demo mode — you're exploring a sample home. No account needed.</span>
      </div>
      <Link href={`${base}/sign-up`}>
        <Button
          size="sm"
          className="h-7 gap-1.5 bg-amber-900 text-amber-50 hover:bg-amber-800 shrink-0 text-xs font-semibold"
        >
          Create free account
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}

function DemoAppRoutes() {
  return (
    <AppLayout topBanner={<DemoBanner />}>
      <Switch>
        <Route path="/">
          {() => <Redirect to="/dashboard" />}
        </Route>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/assets" component={MyAssets} />
        <Route path="/properties" component={Properties} />
        <Route path="/properties/:id" component={PropertyDetail} />
        <Route path="/properties/:propertyId/assets/:assetId" component={AssetDetail} />
        <Route path="/guides" component={Guides} />
        <Route path="/guides/:id" component={GuideDetail} />
        <Route path="/capital-outlook" component={CapitalOutlook} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

// Wraps window.fetch to inject x-demo-token on same-origin /api/ calls only.
function patchFetchForDemo(original: typeof fetch): typeof fetch {
  return function demoFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const isApiCall =
      url.startsWith("/api/") ||
      (url.startsWith(window.location.origin) &&
        new URL(url).pathname.startsWith("/api/"));
    if (!isApiCall) return original(input, init);
    const headers = new Headers((init?.headers as HeadersInit | undefined) ?? {});
    headers.set("x-demo-token", DEMO_TOKEN);
    return original(input, { ...init, headers });
  };
}

function DemoApp() {
  const originalFetchRef = useRef<typeof fetch | null>(null);

  // Patch synchronously during render so child component fetches (triggered by
  // effects that run before this component's own useEffect cleanup) already
  // carry the demo token header.
  if (originalFetchRef.current === null) {
    originalFetchRef.current = window.fetch;
    window.fetch = patchFetchForDemo(window.fetch);
  }
  setExtraHeaders({ "x-demo-token": DEMO_TOKEN });

  useEffect(() => {
    return () => {
      // Restore original fetch and clear extra headers when leaving demo mode.
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
        originalFetchRef.current = null;
      }
      setExtraHeaders({});
    };
  }, []);

  return (
    <WouterRouter base={`${basePath}/demo`}>
      <PropertyProvider>
        <DemoAppRoutes />
      </PropertyProvider>
    </WouterRouter>
  );
}

// ---------------------------------------------------------------------------

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/dashboard`}
      signUpFallbackRedirectUrl={`${basePath}/dashboard`}
      afterSignOutUrl={`${basePath}/`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Casa Dossier account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start documenting your home today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            {/* Demo route — public, no Clerk auth required */}
            <Route path="/demo/*?" component={DemoApp} />
            <Route>
              {() => <ProtectedApp />}
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

import { useEffect } from "react";
import { ClerkProvider, SignIn, useAuth } from "@clerk/react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import MapPage from "@/pages/map";
import MyJobsPage from "@/pages/my-jobs";
import ScanPage from "@/pages/scan";
import ProfileSetup from "@/pages/profile-setup";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

function AuthGate() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-4">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CS</span>
            </div>
            <span className="text-xl font-bold text-foreground">CasaService</span>
          </div>
          <p className="text-sm text-muted-foreground">Technician Portal — sign in to see open jobs near you</p>
        </div>
        <SignIn routing="hash" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/map" />} />
      <Route path="/map" component={MapPage} />
      <Route path="/my-jobs" component={MyJobsPage} />
      <Route path="/scan" component={ScanPage} />
      <Route path="/profile" component={ProfileSetup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <AuthGate />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;

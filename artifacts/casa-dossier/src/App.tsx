import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { PropertyProvider } from "@/contexts/property-context";
import NotFound from "@/pages/not-found";

// Pages
import Dashboard from "@/pages/dashboard";
import Properties from "@/pages/properties";
import PropertyDetail from "@/pages/property-detail";
import AssetDetail from "@/pages/asset-detail";
import IntakeForm from "@/pages/intake";
import Guides from "@/pages/guides";
import GuideDetail from "@/pages/guide-detail";
import Marketplace from "@/pages/marketplace";
import CapitalOutlook from "@/pages/capital-outlook";
import Settings from "@/pages/settings";
import Login from "@/pages/login";
import ClaimTransfer from "@/pages/claim";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/properties" component={Properties} />
        <Route path="/properties/:id" component={PropertyDetail} />
        <Route path="/properties/:propertyId/assets/:assetId" component={AssetDetail} />
        <Route path="/intake" component={IntakeForm} />
        <Route path="/guides" component={Guides} />
        <Route path="/guides/:id" component={GuideDetail} />
        <Route path="/capital-outlook" component={CapitalOutlook} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/settings" component={Settings} />
        <Route path="/login" component={Login} />
        <Route path="/claim/:token" component={ClaimTransfer} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <PropertyProvider>
            <Router />
          </PropertyProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

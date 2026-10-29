import { Mail, Zap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TemplatesPanel } from "./communication-hub/templates-panel";
import { TriggersPanel } from "./communication-hub/triggers-panel";

export function CommunicationHubTab() {
  return (
    <div className="space-y-2">
      <Tabs defaultValue="templates">
        <TabsList className="mb-6">
          <TabsTrigger value="templates" className="gap-2">
            <Mail className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="triggers" className="gap-2">
            <Zap className="h-4 w-4" />
            Auto Triggers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-0">
          <TemplatesPanel />
        </TabsContent>

        <TabsContent value="triggers" className="mt-0">
          <TriggersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

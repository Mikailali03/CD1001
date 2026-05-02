import { useListMarketplaceJobs } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, MapPin, AlertCircle, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function Marketplace() {
  const { data: jobs, isLoading } = useListMarketplaceJobs();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="grid gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const getUrgencyBadge = (urgency?: string) => {
    switch (urgency) {
      case 'emergency': return <Badge variant="destructive" className="animate-pulse">Emergency</Badge>;
      case 'high': return <Badge className="bg-orange-500 hover:bg-orange-600 text-white">High Priority</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open': return <Badge className="bg-chart-5/10 text-chart-5 border-chart-5/20">Open</Badge>;
      case 'claimed': return <Badge className="bg-chart-3/10 text-chart-3 border-chart-3/20">Claimed</Badge>;
      case 'completed': return <Badge className="bg-chart-1/10 text-chart-1 border-chart-1/20"><CheckCircle2 className="w-3 h-3 mr-1"/> Completed</Badge>;
      default: return null;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Pro Marketplace</h1>
          <p className="text-muted-foreground">Browse open service requests and connect with homeowners.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-background">Filter by Category</Button>
          <Button variant="outline" className="bg-background">Sort by Urgency</Button>
        </div>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="space-y-4">
          {jobs.map(job => (
            <Card key={job.id} className={`overflow-hidden hover-elevate transition-all border-l-4 ${job.urgency === 'emergency' ? 'border-l-destructive' : job.urgency === 'high' ? 'border-l-orange-500' : 'border-l-muted'}`}>
              <div className="p-6 flex flex-col sm:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                      {getUrgencyBadge(job.urgency)}
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                      Posted {format(new Date(job.createdAt), 'MMM d')}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold">{job.description}</h3>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm mt-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.city || 'Unknown City'}, {job.state || 'Unknown State'}
                    </p>
                  </div>

                  <div className="bg-muted/40 rounded-lg p-4 border border-dashed flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="bg-background p-2 rounded-md shadow-sm self-start">
                      <Wrench className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target Asset</p>
                      <p className="font-medium text-sm">{job.assetName} <span className="text-muted-foreground font-normal">({job.assetCategory})</span></p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {job.assetBrand || 'No brand'} • {job.assetModel || 'No model'} • {job.assetSerialNumber || 'No S/N'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sm:w-48 flex flex-col justify-center sm:border-l sm:pl-6 gap-3 shrink-0">
                  <Button className="w-full font-semibold shadow-sm" disabled={job.status !== 'open'}>
                    {job.status === 'open' ? 'Claim Job' : job.status === 'claimed' ? 'Already Claimed' : 'Completed'}
                  </Button>
                  <Button variant="outline" className="w-full">
                    View Asset History
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No active jobs</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">
            There are currently no open service requests in the marketplace.
          </p>
        </div>
      )}
    </div>
  );
}

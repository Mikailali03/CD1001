import { useGetAsset, getGetAssetQueryKey, useListServiceRecords, useListMaintenanceTasks } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, AlertTriangle, ShieldAlert, PenTool, Calendar, Tag, Info, Settings, Tool } from "lucide-react";
import { format } from "date-fns";

export default function AssetDetail() {
  const { propertyId, assetId } = useParams<{ propertyId: string, assetId: string }>();

  const { data: asset, isLoading: isAssetLoading } = useGetAsset(assetId!, {
    query: { enabled: !!assetId, queryKey: getGetAssetQueryKey(assetId!) }
  });

  const { data: records, isLoading: isRecordsLoading } = useListServiceRecords(assetId!, {
    query: { enabled: !!assetId, queryKey: ['service-records', assetId!] }
  });

  const { data: tasks, isLoading: isTasksLoading } = useListMaintenanceTasks(assetId!, {
    query: { enabled: !!assetId, queryKey: ['tasks', assetId!] }
  });

  if (isAssetLoading || isRecordsLoading || isTasksLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!asset) return <div className="p-6 text-center">Asset not found</div>;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-chart-1/10 text-chart-1 hover:bg-chart-1/20 border-chart-1/20 py-1"><ShieldCheck className="w-3.5 h-3.5 mr-1"/> Verified</Badge>;
      case 'needs_attention': return <Badge variant="destructive" className="py-1"><AlertTriangle className="w-3.5 h-3.5 mr-1"/> Needs Attention</Badge>;
      default: return <Badge variant="secondary" className="py-1"><ShieldAlert className="w-3.5 h-3.5 mr-1"/> Unverified</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <Link href={`/properties/${propertyId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Property
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary">{asset.name}</h1>
            {getStatusBadge(asset.status)}
          </div>
          <p className="text-muted-foreground">{asset.category} {asset.brand ? `• ${asset.brand}` : ''} {asset.model ? `• ${asset.model}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <PenTool className="h-4 w-4" />
            Edit Info
          </Button>
          <Link href={`/marketplace/new?assetId=${asset.id}`}>
            <Button className="gap-2">
              <Settings className="h-4 w-4" />
              Request Service
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Spec Card */}
        <Card className="md:col-span-3">
          <CardHeader className="bg-secondary/50 pb-4 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              Asset Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5"/> Brand</p>
                <p className="font-medium">{asset.brand || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Model Number</p>
                <p className="font-medium font-mono text-sm">{asset.model || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Serial Number</p>
                <p className="font-medium font-mono text-sm">{asset.serialNumber || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5"/> Install Date</p>
                <p className="font-medium">{asset.installDate ? format(new Date(asset.installDate), 'MMM yyyy') : 'Unknown'}</p>
              </div>
            </div>
            {asset.notes && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm leading-relaxed">{asset.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Schedule */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Maintenance Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            {tasks && tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map(task => (
                  <div key={task.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-sm">{task.title}</p>
                      {task.isDiy && <Badge variant="secondary" className="text-[10px]">DIY</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                    <div className="flex items-center text-xs font-medium mt-3 pt-3 border-t">
                      <Calendar className="h-3 w-3 mr-1" />
                      Due: {format(new Date(task.nextDueDate), 'MMM d, yyyy')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No maintenance tasks scheduled.</p>
            )}
            <Button variant="outline" className="w-full mt-4 text-xs h-8">Add Task</Button>
          </CardContent>
        </Card>

        {/* Service History */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Service History</CardTitle>
          </CardHeader>
          <CardContent>
            {records && records.length > 0 ? (
              <div className="relative border-l ml-3 space-y-6">
                {records.map(record => (
                  <div key={record.id} className="relative pl-6">
                    <div className="absolute -left-2.5 top-1 h-5 w-5 rounded-full bg-secondary border-2 border-background flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-1">
                      <h4 className="font-medium text-sm">{record.description}</h4>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full w-fit">
                        {format(new Date(record.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {record.companyName && <p>{record.companyName} {record.technicianName && `(${record.technicianName})`}</p>}
                      {record.cost && <p className="font-medium text-foreground">${record.cost}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10">
                <Settings className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No service records found.</p>
              </div>
            )}
            <div className="mt-6 pt-6 border-t">
              <Button variant="outline" className="w-full sm:w-auto text-sm">Add Service Record</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

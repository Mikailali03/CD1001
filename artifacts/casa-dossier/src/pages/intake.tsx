import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useCreateAsset, useListProperties } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, CheckCircle2 } from "lucide-react";

const intakeSchema = z.object({
  propertyId: z.string().min(1, "Please select a property"),
  name: z.string().min(2, "Name is required"),
  category: z.enum(["HVAC", "Plumbing", "Electrical", "Roof", "Appliance", "Structural", "Other"]),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installDate: z.string().optional(),
  notes: z.string().optional(),
});

export default function IntakeForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: properties, isLoading: isPropertiesLoading } = useListProperties();
  
  const createAsset = useCreateAsset();

  const form = useForm<z.infer<typeof intakeSchema>>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      propertyId: "",
      name: "",
      category: "HVAC",
      brand: "",
      model: "",
      serialNumber: "",
      installDate: "",
      notes: "",
    },
  });

  function onSubmit(values: z.infer<typeof intakeSchema>) {
    const { propertyId, ...assetData } = values;
    
    // In a real app, this would use the propertyId correctly with the API
    createAsset.mutate(
      { propertyId, data: assetData as any },
      {
        onSuccess: (data) => {
          toast({
            title: "Asset Recorded",
            description: `${data.name} has been added to the dossier.`,
            variant: "default",
          });
          setLocation(`/properties/${propertyId}/assets/${data.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save asset. Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <header className="bg-background border-b sticky top-0 z-10 px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-muted-foreground p-2 -ml-2">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="font-semibold text-primary">Fast Intake</span>
        <div className="w-9" /> {/* Spacer for flex balance */}
      </header>

      <main className="p-4 max-w-lg mx-auto mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="bg-background p-4 rounded-xl border shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="bg-primary/10 p-1.5 rounded-md">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-semibold text-sm">Required Basics</h2>
              </div>

              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Property</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-muted/50 border-transparent focus:bg-background">
                          <SelectValue placeholder="Select property..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties?.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Asset Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Carrier AC Unit" className="h-12 bg-muted/50 border-transparent focus:bg-background" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-12 bg-muted/50 border-transparent focus:bg-background">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HVAC">HVAC</SelectItem>
                        <SelectItem value="Plumbing">Plumbing</SelectItem>
                        <SelectItem value="Electrical">Electrical</SelectItem>
                        <SelectItem value="Roof">Roof</SelectItem>
                        <SelectItem value="Appliance">Appliance</SelectItem>
                        <SelectItem value="Structural">Structural</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-background p-4 rounded-xl border shadow-sm space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b justify-between">
                <h2 className="font-semibold text-sm">Specifications (Optional)</h2>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1.5 px-2">
                  <Camera className="h-3 w-3" />
                  Scan Plate
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Brand/Make</FormLabel>
                      <FormControl>
                        <Input className="h-12 bg-muted/50 border-transparent focus:bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="installDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Mfg Date (YYYY-MM)</FormLabel>
                      <FormControl>
                        <Input type="month" className="h-12 bg-muted/50 border-transparent focus:bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Model Number</FormLabel>
                    <FormControl>
                      <Input className="h-12 font-mono text-sm bg-muted/50 border-transparent focus:bg-background uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Serial Number</FormLabel>
                    <FormControl>
                      <Input className="h-12 font-mono text-sm bg-muted/50 border-transparent focus:bg-background uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Inspector Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Condition notes, access issues, etc." 
                        className="resize-none bg-muted/50 border-transparent focus:bg-background" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full h-14 text-base font-semibold shadow-lg hover-elevate sticky bottom-4 z-20" disabled={createAsset.isPending}>
              {createAsset.isPending ? "Saving Record..." : "Save Asset Record"}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useGetUserProfile, useUpsertUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, HardHat, Wrench, CheckCircle2, Copy } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileSetup() {
  const { user } = useUser();
  const { data: profile, isLoading } = useGetUserProfile({ query: { queryKey: getGetUserProfileQueryKey(), retry: false } });
  const upsert = useUpsertUserProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (profile) {
      setDisplayName((profile as any).displayName ?? user?.fullName ?? "");
      setPhone((profile as any).phone ?? "");
    } else if (user) {
      setDisplayName(user.fullName ?? "");
    }
  }, [profile, user]);

  function handleSave() {
    upsert.mutate(
      { data: { role: "technician", displayName: displayName.trim(), phone: phone.trim() || undefined } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["getUserProfile"] });
          toast({ title: "Profile saved", description: "Your technician profile is active." });
        },
        onError: () => {
          toast({ title: "Error", description: "Could not save profile. Try again.", variant: "destructive" });
        },
      }
    );
  }

  function copyNumber() {
    const num = (profile as any)?.technicianNumber;
    if (num) {
      navigator.clipboard.writeText(num);
      toast({ title: "Copied!", description: `${num} copied to clipboard.` });
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/map">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Map
            </Button>
          </Link>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CS</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">Technician Profile</h1>
          </div>
          <p className="text-sm text-muted-foreground">Set up your profile to start accepting jobs.</p>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Tech number badge */}
            {(profile as any)?.technicianNumber && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardHat className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Your Technician ID</p>
                      <p className="font-mono font-bold text-foreground">{(profile as any).technicianNumber}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={copyNumber} className="gap-1.5 text-xs">
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Profile form */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  Profile Details
                </CardTitle>
                <CardDescription>
                  This info is shown on completed service records in Casa Dossier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Full name</Label>
                  <Input
                    id="display-name"
                    placeholder="e.g. John Smith"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Contact phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g. (555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-2 flex-1">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      Verified Technician
                    </Badge>
                    {(profile as any)?.role === "technician" && (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300">Active</Badge>
                    )}
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={!displayName.trim() || upsert.isPending}
                    className="gap-2"
                  >
                    {upsert.isPending ? "Saving..." : "Save Profile"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Info about CasaService records */}
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When you complete a job, the service record in the homeowner's Casa Dossier will be branded as{" "}
                  <strong className="text-foreground">CasaService</strong> and include your name and technician ID.
                  This gives homeowners a verified record for their home's maintenance history.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

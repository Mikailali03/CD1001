import { useState } from "react";
import { Search, ChevronDown, Loader2, UserCog, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useListAdminUsers,
  getListAdminUsersQueryKey,
  useUpdateAdminUser,
  useBackfillUserProfiles,
  type AdminUser,
  type UserProfileBackfillResult,
} from "@workspace/api-client-react";

const ROLE_LABELS: Record<string, string> = {
  homeowner: "Homeowner",
  technician: "Technician",
  admin: "Admin",
};

const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  homeowner: "secondary",
  technician: "outline",
  admin: "default",
};

function UserRow({ user }: { user: AdminUser }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: updateRole, isPending } = useUpdateAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        toast({ title: "Role updated" });
      },
      onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
    },
  });

  const displayName = `${user.firstName} ${user.lastName}`.trim() || "—";
  const joined = new Date(user.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-muted/40 transition-colors">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-semibold text-primary">
          {user.firstName?.[0]?.toUpperCase() ?? "?"}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
      </div>
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground">Joined {joined}</span>
        {user.technicianNumber && (
          <span className="text-xs text-muted-foreground font-mono">{user.technicianNumber}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={ROLE_VARIANTS[user.role] ?? "secondary"} className="text-xs">
          {ROLE_LABELS[user.role] ?? user.role}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {(["homeowner", "technician", "admin"] as const).map((role) => (
              <DropdownMenuItem
                key={role}
                disabled={user.role === role}
                onSelect={() => updateRole({ userId: user.userId, data: { role } })}
                className="text-sm"
              >
                {ROLE_LABELS[role]}
                {user.role === role && (
                  <span className="ml-auto text-xs text-muted-foreground">Current</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function UsersTab() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [backfillResult, setBackfillResult] = useState<UserProfileBackfillResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  type AdminRole = "homeowner" | "technician" | "admin";
  const roleParam = roleFilter !== "all" ? (roleFilter as AdminRole) : undefined;

  const { data: users = [], isLoading } = useListAdminUsers(
    { search: search || undefined, role: roleParam },
    { query: { queryKey: getListAdminUsersQueryKey({ search, role: roleParam }) } },
  );

  const { mutate: runBackfill, isPending: isBackfilling } = useBackfillUserProfiles({
    mutation: {
      onSuccess: (data) => {
        setBackfillResult(data);
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({}) });
        toast({ title: `Synced ${data.inserted + data.updated} user profiles from Clerk` });
      },
      onError: () => toast({ title: "Backfill failed", variant: "destructive" }),
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Search users"
            className="pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger aria-label="Filter by role" className="w-full sm:w-40">
            <UserCog className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="homeowner">Homeowners</SelectItem>
            <SelectItem value="technician">Technicians</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => runBackfill()}
          disabled={isBackfilling}
        >
          <RefreshCw className={`h-4 w-4 ${isBackfilling ? "animate-spin" : ""}`} />
          {isBackfilling ? "Syncing…" : "Sync from Clerk"}
        </Button>
      </div>

      {backfillResult && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
            backfillResult.errors === 0
              ? "border-green-200 bg-green-50/50"
              : "border-amber-200 bg-amber-50/50"
          }`}
        >
          {backfillResult.errors === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-medium mb-1">
              {backfillResult.errors === 0 ? "Sync complete" : "Sync completed with errors"}
            </p>
            <p className="text-xs text-muted-foreground">
              {backfillResult.totalClerkUsers} Clerk users &nbsp;·&nbsp;{" "}
              <span className="text-green-700 font-medium">{backfillResult.inserted} inserted</span>
              &nbsp;·&nbsp;
              <span className="text-blue-700 font-medium">{backfillResult.updated} updated</span>
              {backfillResult.errors > 0 && (
                <>
                  &nbsp;·&nbsp;
                  <span className="text-amber-700 font-medium">{backfillResult.errors} errors</span>
                </>
              )}
            </p>
            {backfillResult.errorDetails && backfillResult.errorDetails.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {backfillResult.errorDetails.map((e, i) => (
                  <li key={i} className="text-xs text-amber-700">{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No users found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50 p-2">
              {users.map((user) => (
                <UserRow key={user.userId} user={user} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">
        {users.length} user{users.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}

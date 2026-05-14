import { useState } from "react";
import { Search, ChevronDown, Loader2, UserCog } from "lucide-react";
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
  type AdminUser,
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

  type AdminRole = "homeowner" | "technician" | "admin";
  const roleParam = roleFilter !== "all" ? (roleFilter as AdminRole) : undefined;

  const { data: users = [], isLoading } = useListAdminUsers(
    { search: search || undefined, role: roleParam },
    { query: { queryKey: getListAdminUsersQueryKey({ search, role: roleParam }) } },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-40">
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
      </div>

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

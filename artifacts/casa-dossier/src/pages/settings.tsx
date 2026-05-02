import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Shield, User, Key, Mail, Smartphone } from "lucide-react";

export default function Settings() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and notifications.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-muted-foreground"/> Profile Information</CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Alex Homeowner" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="alex@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" defaultValue="(555) 123-4567" />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5 text-muted-foreground"/> Notifications</CardTitle>
            <CardDescription>Choose what alerts you receive.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Maintenance Reminders</Label>
                <p className="text-sm text-muted-foreground">Get notified when tasks are due.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Service Updates</Label>
                <p className="text-sm text-muted-foreground">Alerts when pros update your records.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">Tips, guides, and promotions.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-muted-foreground"/> Security</CardTitle>
            <CardDescription>Manage your password and authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input id="new-password" type="password" />
            </div>
            <Button variant="outline">Update Password</Button>
          </CardContent>
        </Card>

        <Card className="bg-muted/50 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Pro Settings</CardTitle>
            <CardDescription>For service professionals and inspectors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Enable Pro Mode to access marketplace features and quick intake forms.</p>
            <div className="flex items-center justify-between bg-background p-4 rounded-lg border">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Pro Mode</Label>
                <p className="text-xs text-muted-foreground">Unlock inspector tools</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

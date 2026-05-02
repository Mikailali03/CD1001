import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-chart-1/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-md p-6 relative z-10">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3 font-bold text-2xl text-primary">
            <div className="bg-primary p-2.5 rounded-xl shadow-lg">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            Casa Dossier
          </div>
        </div>

        <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/60">
          <CardHeader className="space-y-1 pb-6 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
            <CardDescription className="text-sm">
              Enter your credentials to access your command center
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" className="h-12 bg-background/50" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input id="password" type="password" className="h-12 bg-background/50" />
            </div>
            <Link href="/">
              <Button className="w-full h-12 text-base font-semibold shadow-md hover-elevate mt-4">
                Sign In
              </Button>
            </Link>
          </CardContent>
          <CardFooter className="flex flex-col border-t p-6 gap-4">
            <div className="text-sm text-center text-muted-foreground">
              Don't have an account?{" "}
              <a href="#" className="font-semibold text-primary hover:underline">
                Create one
              </a>
            </div>
          </CardFooter>
        </Card>
        
        <p className="text-center text-xs text-muted-foreground mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { isRoleAllowedOnSubdomain, getCorrectSubdomain, getSubdomainContext } from "@/lib/subdomain";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { toast } = useToast();
  const context = getSubdomainContext();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const { user, tokens } = await api.login(values.email, values.password);
      login(user, tokens);

      // Check if user's role matches the current subdomain
      if (!isRoleAllowedOnSubdomain(user.role)) {
        const redirect = getCorrectSubdomain(user.role);
        if (redirect) {
          toast({
            title: "Wrong portal",
            description: `Redirecting you to ${redirect.label}...`,
          });
          window.location.href = redirect.url;
          return;
        }
      }

      toast({
        title: "Welcome back!",
        description: `Logged in as ${user.firstName} ${user.lastName}`,
      });

      // Redirect based on role
      if (user.role === 'PLATFORM_ADMIN') {
        navigate('/platform/dashboard');
      } else {
        navigate('/org/dashboard');
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password. Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <img
            src="/microcropsymb.png"
            alt="MicroCrop"
            className="mx-auto h-16 w-16 object-contain"
          />
          <div>
            <CardTitle className="text-2xl font-bold">
              {context === 'portal' ? 'MicroCrop Admin' : context === 'network' ? 'MicroCrop Network' : 'MicroCrop'}
            </CardTitle>
            <CardDescription className="mt-1">
              {context === 'portal'
                ? 'Sign in to the platform administration portal'
                : context === 'network'
                  ? 'Sign in to your organization dashboard'
                  : 'Sign in to your account to continue'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </Form>
          
          {context !== 'portal' && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Want to register your organization?{" "}
              <Link to="/register-organization" className="font-medium text-primary hover:underline">
                Register here
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, LogInIcon, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  employeeId: z.string().min(1, { message: 'User ID is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const { login, allUsers, loading: authLoading } = useAuth(); // Added allUsers and authLoading
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employeeId: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const loggedInUser = await login(data.employeeId, data.password, data.rememberMe);
      
      if (loggedInUser) {
        toast({
          title: "Login Successful",
          description: "Welcome back! Redirecting...",
        });
        // Perform redirection based on role
        if (loggedInUser.role === 'admin') {
          router.replace('/admin/dashboard');
        } else if (loggedInUser.role === 'manager' || loggedInUser.role === 'employee') {
          router.replace('/dashboard');
        } else {
          router.replace('/'); 
        }
      } else {
        toast({
          title: "Login Failed",
          description: "Invalid User ID or Password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login process failed:', error);
      toast({
        title: "Login Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Determine if any admin account exists to show/hide the admin signup link
  const adminExists = authLoading ? false : allUsers.some(user => user.role === 'admin');

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <LogInIcon className="w-12 h-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-bold">Welcome to KarobHR</CardTitle>
        <CardDescription>Please sign in with your User ID and Password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Your ID" {...field} suppressHydrationWarning />
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link href="/forgot-password" legacyBehavior>
                      <a className="text-sm text-primary hover:underline">
                        Forgot password?
                      </a>
                    </Link>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} suppressHydrationWarning />
                       <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        suppressHydrationWarning
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      suppressHydrationWarning
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Remember me</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading || authLoading} suppressHydrationWarning>
              {isLoading || authLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Form>

        {!authLoading && !adminExists && ( // Only show if not loading and no admin exists
          <div className="mt-4 text-center">
            <Link href="/admin-signup" legacyBehavior>
              <a className="text-sm text-primary hover:underline inline-flex items-center">
                <UserPlus className="mr-1 h-4 w-4" /> First time? Create Admin Account
              </a>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

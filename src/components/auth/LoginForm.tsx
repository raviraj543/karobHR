
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
import { Eye, EyeOff, LogInIcon, UserPlus, Shield, UserCog, User, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import type { User as KarobUser } from '@/lib/types'; // Import our User type

const loginSchema = z.object({
  employeeId: z.string().min(1, { message: 'User ID is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  // companyId: z.string().min(1, {message: 'Company ID is required.'}).optional(), // Could be added later
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// For Quick Login buttons, ensure these users are created via admin signup or manually in Firebase
const MOCK_ADMIN_ID_FOR_QUICK_LOGIN = 'admin'; // Or whatever ID you use for the first admin
const MOCK_MANAGER_ID_FOR_QUICK_LOGIN = 'manager01';
const MOCK_EMPLOYEE_ID_FOR_QUICK_LOGIN = 'emp001';
const MOCK_PASSWORD_FOR_QUICK_LOGIN = 'password123'; // The password you set for them

export function LoginForm() {
  const router = useRouter();
  const { login, allUsers, loading: authContextLoading } = useAuth(); // Renamed loading to avoid conflict
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission state
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

  const handleLoginSuccess = (loggedInUser: KarobUser) => {
    toast({
      title: "Login Successful",
      description: `Welcome back, ${loggedInUser.name}! Redirecting...`,
    });
    if (loggedInUser.role === 'admin') {
      router.replace('/admin/dashboard');
    } else if (loggedInUser.role === 'manager' || loggedInUser.role === 'employee') {
      router.replace('/dashboard');
    } else {
      router.replace('/'); // Fallback
    }
  };

  const handleLoginFailure = (message = "Invalid User ID or Password.") => {
     toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
  }

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      // For multi-company, you might need to pass a company identifier from the form
      // For now, the login function in AuthContext might use a default or derive it.
      const loggedInUser = await login(data.employeeId, data.password);
      if (loggedInUser) {
        handleLoginSuccess(loggedInUser);
      } else {
        // This case might occur if Firebase auth succeeds but profile fetch fails
        // or if login function explicitly returns null for other reasons.
        handleLoginFailure("Login successful, but could not load user profile. Please contact support.");
      }
    } catch (error: any) {
      console.error('Login process failed:', error);
      let errorMessage = "An unexpected error occurred during login.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Invalid User ID or Password.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      handleLoginFailure(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (userId: string) => {
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(userId, MOCK_PASSWORD_FOR_QUICK_LOGIN);
      if (loggedInUser) {
        handleLoginSuccess(loggedInUser);
      } else {
        handleLoginFailure(`Mock user '${userId}' login failed or profile not found. Ensure user exists in Firebase with password '${MOCK_PASSWORD_FOR_QUICK_LOGIN}'.`);
      }
    } catch (error: any) {
      console.error('Quick login failed:', error);
      handleLoginFailure((error as Error).message || "An unexpected error occurred during quick login.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const adminExistsInSystem = authContextLoading ? false : allUsers.some(user => user.role === 'admin');


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
                    <Input type="text" placeholder="Your User ID (e.g., admin, emp001)" {...field} />
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
                      <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                       <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/*
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company ID (Optional)</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Your Company ID" {...field} />
                  </FormControl>
                  <FormDescription>Required if your company uses a specific identifier.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            */}
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Remember me</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || authContextLoading}>
              {(isSubmitting || authContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </Form>

        {!authContextLoading && !adminExistsInSystem && (
          <div className="mt-6 text-center">
            <Link href="/admin-signup" legacyBehavior>
              <a className="text-sm text-primary hover:underline inline-flex items-center">
                <UserPlus className="mr-1 h-4 w-4" /> First time? Create Company & Admin Account
              </a>
            </Link>
             <p className="text-xs text-muted-foreground mt-1">(No admin account found in the system)</p>
          </div>
        )}

        {/* Quick Login Buttons for Testing - visible if not authContextLoading */}
        {!authContextLoading && (
          <>
            <Separator className="my-6" />
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">For testing (ensure users exist in Firebase):</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => handleQuickLogin(MOCK_ADMIN_ID_FOR_QUICK_LOGIN)} disabled={isSubmitting || authContextLoading}>
                  {(isSubmitting || authContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Shield className="mr-2 h-4 w-4" /> Admin
                </Button>
                <Button variant="outline" onClick={() => handleQuickLogin(MOCK_MANAGER_ID_FOR_QUICK_LOGIN)} disabled={isSubmitting || authContextLoading}>
                  {(isSubmitting || authContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <UserCog className="mr-2 h-4 w-4" /> Manager
                </Button>
                <Button variant="outline" onClick={() => handleQuickLogin(MOCK_EMPLOYEE_ID_FOR_QUICK_LOGIN)} disabled={isSubmitting || authContextLoading}>
                 {(isSubmitting || authContextLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <User className="mr-2 h-4 w-4" /> Employee
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">(Default Password: {MOCK_PASSWORD_FOR_QUICK_LOGIN})</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

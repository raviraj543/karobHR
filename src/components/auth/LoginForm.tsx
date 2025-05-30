
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
import { Eye, EyeOff, LogInIcon, UserCheck, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  employeeId: z.string().min(1, { message: 'Employee ID is required.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Predefined credentials for quick login (should match those in AuthContext mocks)
const QUICK_LOGIN_EMPLOYEE_ID = 'emp101';
const QUICK_LOGIN_EMPLOYEE_PASS = 'employeepass';
const QUICK_LOGIN_ADMIN_ID = 'admin001';
const QUICK_LOGIN_ADMIN_PASS = 'adminpass';

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
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
      await login(data.employeeId, data.password, data.rememberMe);
      
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      // AuthProvider's useEffect in combination with app/page.tsx handles redirection
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: "Login Failed",
        description: (error as Error).message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleQuickLogin = async (id: string, pass: string) => {
    form.setValue('employeeId', id);
    form.setValue('password', pass);
    await onSubmit(form.getValues());
  };

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <LogInIcon className="w-12 h-12 text-primary" />
        </div>
        <CardTitle className="text-3xl font-bold">Welcome to BizFlow</CardTitle>
        <CardDescription>Please sign in with your Employee ID and Password.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee ID</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Your Employee ID" {...field} />
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </Form>
        <div className="mt-6 space-y-2">
          <p className="text-center text-sm text-muted-foreground">For development:</p>
          <Button variant="outline" className="w-full" onClick={() => handleQuickLogin(QUICK_LOGIN_EMPLOYEE_ID, QUICK_LOGIN_EMPLOYEE_PASS)} disabled={isLoading}>
            <UserCheck className="mr-2 h-4 w-4" /> Quick Login as Employee ({QUICK_LOGIN_EMPLOYEE_ID})
          </Button>
          <Button variant="outline" className="w-full" onClick={() => handleQuickLogin(QUICK_LOGIN_ADMIN_ID, QUICK_LOGIN_ADMIN_PASS)} disabled={isLoading}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Quick Login as Admin ({QUICK_LOGIN_ADMIN_ID})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

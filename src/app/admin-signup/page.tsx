
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from '@/hooks/use-toast';
import { ShieldPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const adminSignupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  adminId: z.string().min(3, { message: 'Admin ID must be at least 3 characters.' })
    .regex(/^[a-zA-Z0-9_.-]*$/, { message: 'Admin ID can only contain letters, numbers, and _ . -' }),
  email: z.string().email({ message: 'Invalid email address.' }).optional().or(z.literal('')),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  confirmPassword: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AdminSignupFormValues = z.infer<typeof adminSignupSchema>;

export default function AdminSignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<AdminSignupFormValues>({
    resolver: zodResolver(adminSignupSchema),
    defaultValues: {
      name: '',
      adminId: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: AdminSignupFormValues) => {
    setIsLoading(true);
    console.log('New Admin Signup Data (Mock):', data);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast({
      title: "Admin Account Notional Creation",
      description: (
        <div>
          <p>Admin account for '{data.adminId}' has been notionally created.</p>
          <p className="mt-2 text-xs">
            In a real application, this would save the admin's credentials. For this demo,
            you can log in using the pre-configured admin account (ID: admin001, Pass: adminpass).
          </p>
          <p className="mt-1 text-xs">
            To test logging in with this new account ('{data.adminId}', Pass: '{data.password}'),
            you would need to manually add these credentials to the `mockCredentials` and `mockUserProfiles`
            in <code>src/lib/authContext.tsx</code> and restart the application.
          </p>
        </div>
      ),
      duration: 15000, // Longer duration for the detailed message
    });
    form.reset();
    setIsLoading(false);
    // Optionally redirect to login page after a delay or user action
    // setTimeout(() => router.push('/login'), 3000);
  };
  
  useEffect(() => {
    document.title = 'Create Admin Account - Floattend';
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <ShieldPlus className="mr-2 h-8 w-8 text-primary" />
              <CardTitle className="text-2xl font-bold">Create Admin Account</CardTitle>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
              </Link>
            </Button>
          </div>
          <CardDescription>
            Fill in the details to create a new administrator account.
            This is a mock process for demonstration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Site Administrator" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="adminId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin ID (for Login)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., main_admin" {...field} />
                      </FormControl>
                       <FormDescription>Unique ID for login. No spaces or special chars other than _ . -</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g., admin@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Admin Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
